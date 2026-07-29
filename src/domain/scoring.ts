import type {
  Answer,
  Domain,
  GroupScore,
  Question
} from "../data/types";

export interface AnswerScore {
  correct: boolean;
  expected: Answer;
  received: Answer;
}

function canonicalRecord(value: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function expectedAnswer(question: Question): Answer {
  switch (question.type) {
    case "multiple-choice":
      return question.correctId;
    case "multiple-response":
      return [...question.correctIds].sort();
    case "ordering":
      return [...question.correctOrder];
    case "matching":
      return { ...question.correctMatches };
  }
}

export function normalizeAnswer(question: Question, answer: Answer): Answer {
  if (question.type === "multiple-response" && Array.isArray(answer)) {
    return [...answer].sort();
  }

  if (
    question.type === "matching" &&
    typeof answer === "object" &&
    !Array.isArray(answer)
  ) {
    return Object.fromEntries(
      Object.entries(answer).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    );
  }

  return answer;
}

export function scoreAnswer(
  question: Question,
  answer: Answer
): AnswerScore {
  const expected = expectedAnswer(question);
  const received = normalizeAnswer(question, answer);

  let correct = false;
  if (typeof expected === "string" && typeof received === "string") {
    correct = expected.length > 0 && expected === received;
  } else if (Array.isArray(expected) && Array.isArray(received)) {
    correct =
      expected.length === received.length &&
      expected.every((value, index) => value === received[index]);
  } else if (
    typeof expected === "object" &&
    !Array.isArray(expected) &&
    typeof received === "object" &&
    !Array.isArray(received)
  ) {
    correct =
      Object.keys(expected).length === Object.keys(received).length &&
      canonicalRecord(expected) === canonicalRecord(received);
  }

  return { correct, expected, received };
}

export function scoreGroup(
  questions: Question[],
  answers: Record<string, Answer>
): GroupScore {
  const domains = [1, 2, 3, 4, 5] as const;
  const byDomain = Object.fromEntries(
    domains.map((domain) => [domain, { total: 0, correct: 0 }])
  ) as Record<Domain, { total: number; correct: number }>;

  let correct = 0;
  for (const question of questions) {
    const result = scoreAnswer(question, answers[question.id] ?? "");
    byDomain[question.domain].total += 1;
    if (result.correct) {
      correct += 1;
      byDomain[question.domain].correct += 1;
    }
  }

  return {
    total: questions.length,
    correct,
    percentage:
      questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100),
    byDomain
  };
}
