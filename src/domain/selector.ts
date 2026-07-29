import type { LearnerState, Question } from "../data/types";
import { conceptMastery } from "./mastery";

function seedNumber(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed: string): () => number {
  let value = seedNumber(seed);
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const result = [...items];
  const random = randomFrom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function uniqueBank(bank: Question[]): Question[] {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  return bank.filter((question) => {
    if (ids.has(question.id) || fingerprints.has(question.fingerprint)) {
      return false;
    }
    ids.add(question.id);
    fingerprints.add(question.fingerprint);
    return true;
  });
}

function hasAttempt(state: LearnerState, question: Question): boolean {
  return (state.attempts[question.id]?.length ?? 0) > 0;
}

function masteryForQuestion(
  state: LearnerState,
  question: Question
): number {
  return Math.min(
    ...question.concepts.map((concept) => conceptMastery(state, concept))
  );
}

function isDue(
  state: LearnerState,
  question: Question,
  today: string
): boolean {
  return (
    hasAttempt(state, question) &&
    question.concepts.some(
      (concept) =>
        state.mastery[concept] !== undefined &&
        state.mastery[concept]!.dueOn <= today
    )
  );
}

function diagnosticGroup(
  bank: Question[],
  today: string,
  size: number
): Question[] {
  const byDomain = new Map<number, Question[]>();
  for (const domain of [1, 2, 3, 4, 5]) {
    byDomain.set(
      domain,
      shuffled(
        bank.filter((question) => question.domain === domain),
        `${today}:diagnostic:${domain}`
      )
    );
  }

  const selected: Question[] = [];
  while (selected.length < Math.min(size, bank.length)) {
    let added = false;
    for (const domain of [1, 2, 3, 4, 5]) {
      const next = byDomain.get(domain)?.shift();
      if (next) {
        selected.push(next);
        added = true;
        if (selected.length >= Math.min(size, bank.length)) break;
      }
    }
    if (!added) break;
  }
  return selected;
}

function ensureDomainBreadth(
  selected: Question[],
  bank: Question[],
  desired: number
): Question[] {
  const availableDomains = new Set(bank.map((question) => question.domain));
  const minimum = Math.min(3, availableDomains.size, desired);
  let selectedDomains = new Set(selected.map((question) => question.domain));
  if (selectedDomains.size >= minimum) return selected;

  const ids = new Set(selected.map((question) => question.id));
  const fingerprints = new Set(
    selected.map((question) => question.fingerprint)
  );
  const result = [...selected];
  for (const domain of availableDomains) {
    if (selectedDomains.has(domain) || selectedDomains.size >= minimum) {
      continue;
    }
    const replacement = bank.find(
      (question) =>
        question.domain === domain &&
        !ids.has(question.id) &&
        !fingerprints.has(question.fingerprint)
    );
    if (!replacement || result.length === 0) continue;
    const domainCounts = new Map<number, number>();
    for (const question of result) {
      domainCounts.set(
        question.domain,
        (domainCounts.get(question.domain) ?? 0) + 1
      );
    }
    let replacementIndex = -1;
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const question = result[index]!;
      if ((domainCounts.get(question.domain) ?? 0) > 1) {
        replacementIndex = index;
        break;
      }
    }
    if (replacementIndex < 0) continue;
    const removed = result[replacementIndex]!;
    ids.delete(removed.id);
    fingerprints.delete(removed.fingerprint);
    result[replacementIndex] = replacement;
    ids.add(replacement.id);
    fingerprints.add(replacement.fingerprint);
    selectedDomains = new Set(result.map((question) => question.domain));
  }
  return result;
}

export function selectDailyGroup(
  bank: Question[],
  state: LearnerState,
  today: string,
  size = 25
): Question[] {
  const unique = uniqueBank(bank);
  const desired = Math.min(size, unique.length);
  const attemptedCount = Object.values(state.attempts).filter(
    (attempts) => attempts.length > 0
  ).length;
  if (attemptedCount === 0) {
    return diagnosticGroup(unique, today, desired);
  }

  const unseen = unique.filter((question) => !hasAttempt(state, question));
  const weak = unique.filter(
    (question) =>
      hasAttempt(state, question) &&
      masteryForQuestion(state, question) < 0.65
  );
  const review = unique.filter(
    (question) =>
      hasAttempt(state, question) &&
      masteryForQuestion(state, question) >= 0.65 &&
      isDue(state, question, today)
  );
  const selected: Question[] = [];
  const selectedIds = new Set<string>();
  const selectedFingerprints = new Set<string>();

  const take = (pool: Question[], count: number, label: string): void => {
    for (const question of shuffled(pool, `${today}:${label}`)) {
      if (selected.length >= desired || count <= 0) break;
      if (
        selectedIds.has(question.id) ||
        selectedFingerprints.has(question.fingerprint)
      ) {
        continue;
      }
      selected.push(question);
      selectedIds.add(question.id);
      selectedFingerprints.add(question.fingerprint);
      count -= 1;
    }
  };

  take(weak, Math.min(13, desired), "weak");
  take(unseen, Math.min(7, desired - selected.length), "unseen");
  take(review, Math.min(5, desired - selected.length), "review");

  const remaining = shuffled(unique, `${today}:fallback`).sort(
    (left, right) =>
      masteryForQuestion(state, left) - masteryForQuestion(state, right)
  );
  take(remaining, desired - selected.length, "remaining");

  return ensureDomainBreadth(selected, unique, desired);
}

export function selectMock(
  bank: Question[],
  size = 65,
  seed = "mock"
): Question[] {
  const unique = uniqueBank(bank);
  const desired = Math.min(size, unique.length);
  const formats = [
    "multiple-choice",
    "multiple-response",
    "ordering",
    "matching"
  ] as const;
  const required =
    desired >= formats.filter((format) =>
      unique.some((question) => question.type === format)
    ).length
      ? formats
          .map((format) =>
            shuffled(
              unique.filter((question) => question.type === format),
              `mock:${seed}:format:${format}`
            )[0]
          )
          .filter((question): question is Question => question !== undefined)
      : [];
  const requiredIds = new Set(required.map((question) => question.id));
  const remaining = shuffled(
    unique.filter((question) => !requiredIds.has(question.id)),
    `mock:${seed}`
  );
  return [...required, ...remaining].slice(0, desired);
}

export function selectSourceGroup(
  bank: Question[],
  videoId: string
): Question[] {
  return uniqueBank(
    bank.filter((question) =>
      question.sources.some((source) => source.videoId === videoId)
    )
  );
}
