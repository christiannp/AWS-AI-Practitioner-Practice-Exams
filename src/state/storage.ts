import type {
  Answer,
  Attempt,
  LearnerState,
  MasteryRecord,
  StudySession
} from "../data/types";

export const STORAGE_KEY = "aws-aif-study-state";

function defaultState(): LearnerState {
  return {
    version: 1,
    settings: { targetDate: "2026-08-31" },
    attempts: {},
    mastery: {},
    sessions: []
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

function isMasteryRecord(value: unknown): value is MasteryRecord {
  return (
    isObject(value) &&
    typeof value.score === "number" &&
    value.score >= 0 &&
    value.score <= 1 &&
    Number.isInteger(value.successStreak) &&
    (value.successStreak as number) >= 0 &&
    typeof value.dueOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.dueOn)
  );
}

function isStudySession(value: unknown): value is StudySession {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    ["daily", "mock", "source"].includes(String(value.mode)) &&
    Array.isArray(value.questionIds) &&
    value.questionIds.every((item) => typeof item === "string") &&
    typeof value.completedAt === "string" &&
    Number.isInteger(value.correctCount) &&
    (value.correctCount as number) >= 0
  );
}

function isInProgress(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    ["daily", "mock", "source"].includes(String(value.mode)) &&
    Array.isArray(value.questionIds) &&
    value.questionIds.every((item) => typeof item === "string") &&
    isObject(value.answers) &&
    Object.values(value.answers).every(isAnswer) &&
    Number.isInteger(value.currentIndex) &&
    (value.currentIndex as number) >= 0
  );
}

function isLearnerState(value: unknown): value is LearnerState {
  if (!isObject(value) || value.version !== 1) return false;
  if (
    !isObject(value.settings) ||
    typeof value.settings.targetDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.settings.targetDate)
  ) {
    return false;
  }
  if (!isObject(value.attempts) || !isObject(value.mastery)) return false;
  if (
    !Object.values(value.attempts).every(
      (attempts) => Array.isArray(attempts) && attempts.every(isAttempt)
    )
  ) {
    return false;
  }
  if (!Object.values(value.mastery).every(isMasteryRecord)) return false;
  if (
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isStudySession)
  ) {
    return false;
  }
  return value.inProgress === undefined || isInProgress(value.inProgress);
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
    throw new Error("Invalid backup JSON.");
  }

  if (isObject(parsed) && parsed.version !== 1) {
    throw new Error(`Unsupported learner-state version: ${String(parsed.version)}.`);
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
  if (payload === null) return { state: defaultState() };

  try {
    return { state: importState(payload) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid local learner state.";
    return {
      state: defaultState(),
      recoveryPayload: payload,
      error: `Local progress is corrupt or invalid: ${message}`
    };
  }
}

export function saveState(storage: Storage, state: LearnerState): void {
  storage.setItem(STORAGE_KEY, exportState(state));
}

export function resetState(storage: Storage): LearnerState {
  storage.removeItem(STORAGE_KEY);
  return defaultState();
}
