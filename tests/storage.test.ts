import { describe, expect, it } from "vitest";

import type { LearnerState } from "../src/data/types";
import {
  discardRecovery,
  loadState,
  RECOVERY_KEY,
  saveState,
  STORAGE_KEY
} from "../src/state/storage";
import legacyFixture from "./fixtures/state.json";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class RecoveryQuotaStorage extends MemoryStorage {
  override setItem(key: string, value: string): void {
    if (key === RECOVERY_KEY) {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    }
    super.setItem(key, value);
  }
}

const validState: LearnerState = {
  version: 2,
  attempts: {
    "fixture-mc": [
      {
        questionId: "fixture-mc",
        answer: "a",
        correct: false,
        completedAt: "2026-07-29T08:00:00.000Z"
      }
    ]
  },
  examResults: {
    "1": {
      examId: 1,
      score: 0,
      correct: 0,
      total: 65,
      completedAt: "2026-07-29T08:00:00.000Z",
      masteryQueue: ["fixture-mc"],
      mastered: false
    }
  },
  wrongHistory: [
    {
      questionId: "fixture-mc",
      answer: "a",
      correct: false,
      completedAt: "2026-07-29T08:00:00.000Z",
      examId: 1,
      roundId: "exam-1-1"
    }
  ],
  inProgress: {
    id: "exam-1-1",
    examId: 1,
    mode: "retry",
    questionIds: ["fixture-mc"],
    answers: {},
    page: 0
  },
  latestResult: {
    examId: 1,
    roundId: "exam-1-1",
    mode: "exam",
    questionIds: ["fixture-mc"],
    wrongQuestionIds: ["fixture-mc"],
    answers: { "fixture-mc": "a" },
    completedAt: "2026-07-29T08:00:00.000Z",
    correct: 0
  }
};

describe("local exam-state persistence", () => {
  it("starts with empty browser-only exam state", () => {
    expect(loadState(new MemoryStorage()).state).toEqual({
      version: 2,
      attempts: {},
      examResults: {},
      wrongHistory: []
    });
  });

  it("round-trips exam results and a resumable retry", () => {
    const storage = new MemoryStorage();
    saveState(storage, validState);

    expect(loadState(storage).state).toEqual(validState);
  });

  it("migrates v1 attempts and discards planner fields", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(legacyFixture));

    const migrated = loadState(storage).state;

    expect(migrated.version).toBe(2);
    expect(migrated.attempts).toEqual(legacyFixture.attempts);
    expect(migrated.examResults).toEqual({});
    expect(migrated.wrongHistory).toEqual([]);
    expect(migrated).not.toHaveProperty("settings");
    expect(migrated).not.toHaveProperty("mastery");
    expect(migrated).not.toHaveProperty("sessions");
    expect(migrated.inProgress).toBeUndefined();
  });

  it("recovers safely from corrupt local JSON without deleting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not valid json");

    const result = loadState(storage);

    expect(result.state.version).toBe(2);
    expect(result.recoveryPayload).toBe("{not valid json");
    expect(result.error).toMatch(/corrupt|invalid/i);
    expect(storage.getItem(STORAGE_KEY)).toBe("{not valid json");
    expect(storage.getItem(RECOVERY_KEY)).toBe("{not valid json");
  });

  it("preserves corrupt recovery through normal saves until explicit discard", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not valid json");

    expect(loadState(storage).recoveryPayload).toBe("{not valid json");
    saveState(storage, validState);

    const reloaded = loadState(storage);
    expect(reloaded.state).toEqual(validState);
    expect(reloaded.recoveryPayload).toBe("{not valid json");

    discardRecovery(storage);
    expect(loadState(storage).recoveryPayload).toBeUndefined();
    expect(storage.getItem(RECOVERY_KEY)).toBeNull();
  });

  it("protects the primary corrupt payload when recovery persistence exceeds quota", () => {
    const storage = new RecoveryQuotaStorage();
    storage.setItem(STORAGE_KEY, "{large corrupt payload");

    expect(loadState(storage).recoveryPayload).toBe("{large corrupt payload");
    saveState(storage, validState);
    expect(storage.getItem(STORAGE_KEY)).toBe("{large corrupt payload");

    discardRecovery(storage);
    saveState(storage, validState);
    expect(loadState(storage).state).toEqual(validState);
  });

  it("rejects a structurally invalid version-2 save", () => {
    const storage = new MemoryStorage();

    expect(() =>
      saveState(storage, {
        version: 2,
        attempts: {},
        examResults: {},
        wrongHistory: [],
        inProgress: {
          id: "broken",
          examId: 1,
          mode: "exam",
          questionIds: [],
          answers: {},
          page: -1
        }
      })
    ).toThrow(/invalid learner-state/i);
  });
});
