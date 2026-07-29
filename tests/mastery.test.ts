import { describe, expect, it } from "vitest";

import type { LearnerState, Question } from "../src/data/types";
import { conceptMastery, recordAttempt } from "../src/domain/mastery";
import questions from "./fixtures/questions.json";

const question = questions[0] as Question;

function emptyState(): LearnerState {
  return {
    version: 1,
    settings: { targetDate: "2026-08-31" },
    attempts: {},
    mastery: {},
    sessions: []
  };
}

describe("mastery", () => {
  it("starts a new concept at the transparent 0.35 baseline", () => {
    expect(conceptMastery(emptyState(), question.concepts[0]!)).toBe(0.35);
  });

  it("lowers mastery after an error and schedules next-day review", () => {
    const state = recordAttempt(
      emptyState(),
      question,
      false,
      "2026-07-29T08:00:00.000Z"
    );
    const record = state.mastery[question.concepts[0]!]!;

    expect(record).toEqual({
      score: 0.15,
      successStreak: 0,
      dueOn: "2026-07-30"
    });
    expect(state.attempts[question.id]).toHaveLength(1);
  });

  it("raises mastery and expands review intervals after spaced successes", () => {
    let state = emptyState();
    for (const completedAt of [
      "2026-07-29T08:00:00.000Z",
      "2026-07-30T08:00:00.000Z",
      "2026-08-02T08:00:00.000Z"
    ]) {
      state = recordAttempt(state, question, true, completedAt);
    }

    expect(state.mastery[question.concepts[0]!]).toEqual({
      score: 0.8,
      successStreak: 3,
      dueOn: "2026-08-09"
    });
  });

  it("resets a correct-answer streak after a later error", () => {
    const onceCorrect = recordAttempt(
      emptyState(),
      question,
      true,
      "2026-07-29T08:00:00.000Z"
    );
    const thenWrong = recordAttempt(
      onceCorrect,
      question,
      false,
      "2026-07-30T08:00:00.000Z"
    );

    expect(thenWrong.mastery[question.concepts[0]!]!.successStreak).toBe(0);
    expect(thenWrong.mastery[question.concepts[0]!]!.dueOn).toBe(
      "2026-07-31"
    );
  });
});
