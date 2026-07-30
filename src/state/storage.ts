import type {
  Answer,
  Attempt,
  ExamResult,
  InProgressExam,
  LearnerState,
  SubmittedRound,
  WrongAttempt
} from "../data/types";

export const STORAGE_KEY = "aws-aif-study-state";
export const RECOVERY_KEY = "aws-aif-study-state-recovery";
const protectedPrimaryRecovery = new WeakSet<Storage>();

function defaultState(): LearnerState {
  return {
    version: 2,
    attempts: {},
    examResults: {},
    wrongHistory: []
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnswer(value: unknown): value is Answer {
  return (
    typeof value === "string" ||
    (Array.isArray(value) &&
      value.every((item) => typeof item === "string")) ||
    (isObject(value) &&
      Object.values(value).every((item) => typeof item === "string"))
  );
}

function isAttempt(value: unknown): value is Attempt {
  return (
    isObject(value) &&
    typeof value.questionId === "string" &&
    isAnswer(value.answer) &&
    typeof value.correct === "boolean" &&
    typeof value.completedAt === "string"
  );
}

function isAttemptMap(value: unknown): value is Record<string, Attempt[]> {
  return (
    isObject(value) &&
    Object.values(value).every(
      (attempts) => Array.isArray(attempts) && attempts.every(isAttempt)
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isExamResult(value: unknown): value is ExamResult {
  return (
    isObject(value) &&
    Number.isInteger(value.examId) &&
    (value.examId as number) > 0 &&
    typeof value.score === "number" &&
    value.score >= 0 &&
    value.score <= 100 &&
    Number.isInteger(value.correct) &&
    (value.correct as number) >= 0 &&
    Number.isInteger(value.total) &&
    (value.total as number) > 0 &&
    (value.correct as number) <= (value.total as number) &&
    typeof value.completedAt === "string" &&
    isStringArray(value.masteryQueue) &&
    typeof value.mastered === "boolean"
  );
}

function isWrongAttempt(value: unknown): value is WrongAttempt {
  return (
    isAttempt(value) &&
    isObject(value) &&
    Number.isInteger(value.examId) &&
    (value.examId as number) > 0 &&
    typeof value.roundId === "string"
  );
}

function isInProgress(value: unknown): value is InProgressExam {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    Number.isInteger(value.examId) &&
    (value.examId as number) > 0 &&
    (value.mode === "exam" || value.mode === "retry") &&
    isStringArray(value.questionIds) &&
    value.questionIds.length > 0 &&
    isObject(value.answers) &&
    Object.values(value.answers).every(isAnswer) &&
    Number.isInteger(value.page) &&
    (value.page as number) >= 0
  );
}

function isSubmittedRound(value: unknown): value is SubmittedRound {
  return (
    isObject(value) &&
    Number.isInteger(value.examId) &&
    (value.examId as number) > 0 &&
    typeof value.roundId === "string" &&
    (value.mode === "exam" || value.mode === "retry") &&
    isStringArray(value.questionIds) &&
    value.questionIds.length > 0 &&
    isStringArray(value.wrongQuestionIds) &&
    isObject(value.answers) &&
    Object.values(value.answers).every(isAnswer) &&
    typeof value.completedAt === "string" &&
    Number.isInteger(value.correct) &&
    (value.correct as number) >= 0 &&
    (value.correct as number) <= value.questionIds.length
  );
}

function isLearnerState(value: unknown): value is LearnerState {
  if (!isObject(value) || value.version !== 2) return false;
  if (!isAttemptMap(value.attempts) || !isObject(value.examResults)) {
    return false;
  }
  if (!Object.values(value.examResults).every(isExamResult)) return false;
  if (
    !Array.isArray(value.wrongHistory) ||
    !value.wrongHistory.every(isWrongAttempt)
  ) {
    return false;
  }
  if (value.inProgress !== undefined && !isInProgress(value.inProgress)) {
    return false;
  }
  return (
    value.latestResult === undefined ||
    isSubmittedRound(value.latestResult)
  );
}

function migrateVersionOne(value: Record<string, unknown>): LearnerState {
  if (!isAttemptMap(value.attempts)) {
    throw new Error("Invalid version-1 learner-state attempts.");
  }
  return {
    version: 2,
    attempts: structuredClone(value.attempts),
    examResults: {},
    wrongHistory: []
  };
}

export interface LoadResult {
  state: LearnerState;
  recoveryPayload?: string;
  error?: string;
}

export function importState(json: string): LearnerState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid local learner-state JSON.");
  }

  if (isObject(parsed) && parsed.version === 1) {
    return migrateVersionOne(parsed);
  }
  if (isObject(parsed) && parsed.version !== 2) {
    throw new Error(
      `Unsupported learner-state version: ${String(parsed.version)}.`
    );
  }
  if (!isLearnerState(parsed)) {
    throw new Error("Invalid learner-state structure.");
  }
  return structuredClone(parsed);
}

export function exportState(state: LearnerState): string {
  if (!isLearnerState(state)) {
    throw new Error("Invalid learner-state structure.");
  }
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function loadState(storage: Storage): LoadResult {
  const payload = storage.getItem(STORAGE_KEY);
  const preservedRecovery = storage.getItem(RECOVERY_KEY) ?? undefined;
  if (payload === null) {
    return {
      state: defaultState(),
      ...(preservedRecovery === undefined
        ? {}
        : { recoveryPayload: preservedRecovery })
    };
  }

  try {
    const state = importState(payload);
    if (state.version === 2 && JSON.parse(payload).version === 1) {
      try {
        storage.setItem(STORAGE_KEY, exportState(state));
      } catch {
        // The in-memory migration is still usable when local storage is full.
      }
    }
    return {
      state,
      ...(preservedRecovery === undefined
        ? {}
        : { recoveryPayload: preservedRecovery })
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid local learner state.";
    const recoveryPayload = preservedRecovery ?? payload;
    if (preservedRecovery === undefined) {
      try {
        storage.setItem(RECOVERY_KEY, payload);
        protectedPrimaryRecovery.delete(storage);
      } catch {
        protectedPrimaryRecovery.add(storage);
      }
    }
    return {
      state: defaultState(),
      recoveryPayload,
      error: `Local progress is corrupt or invalid: ${message}`
    };
  }
}

export function saveState(storage: Storage, state: LearnerState): void {
  if (protectedPrimaryRecovery.has(storage)) return;
  storage.setItem(STORAGE_KEY, exportState(state));
}

export function discardRecovery(storage: Storage): void {
  protectedPrimaryRecovery.delete(storage);
  storage.removeItem(RECOVERY_KEY);
  const payload = storage.getItem(STORAGE_KEY);
  if (payload === null) return;
  try {
    importState(payload);
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
}
