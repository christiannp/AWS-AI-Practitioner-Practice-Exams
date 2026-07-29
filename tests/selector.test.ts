import { describe, expect, it } from "vitest";

import type { LearnerState, Question } from "../src/data/types";
import {
  selectDailyGroup,
  selectMock,
  selectSourceGroup
} from "../src/domain/selector";

function makeQuestion(index: number, bucket: string): Question {
  const domain = ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  return {
    id: `${bucket}-${index}`,
    origin: "official-addition",
    type: "multiple-choice",
    prompt: `Fixture ${bucket} question ${index} asks for the controlled correct option.`,
    domain,
    task: `${domain}.1`,
    difficulty: index % 2 === 0 ? "foundation" : "exam",
    concepts: [`${bucket}-concept-${index}`],
    services: [],
    options: [
      { id: "a", text: "Correct" },
      { id: "b", text: "Wrong", distractorReason: "Fixture distractor." },
      { id: "c", text: "Wronger", distractorReason: "Fixture distractor." },
      { id: "d", text: "Wrongest", distractorReason: "Fixture distractor." }
    ],
    correctId: "a",
    explanation: "The controlled fixture marks option A as correct.",
    sources:
      index < 5
        ? [
            {
              playlistId: "fixture",
              videoId: "source-video",
              videoTitle: "Fixture source",
              url: "https://www.youtube.com/watch?v=source-video"
            }
          ]
        : [],
    verification: [
      {
        title: "Fixture",
        url: "https://example.com",
        verifiedOn: "2026-07-29"
      }
    ],
    fingerprint: `${bucket}-fingerprint-${index}`
  };
}

function adaptiveFixture(): { bank: Question[]; state: LearnerState } {
  const groups = [
    ...Array.from({ length: 20 }, (_, index) => makeQuestion(index, "weak")),
    ...Array.from({ length: 20 }, (_, index) => makeQuestion(index, "review")),
    ...Array.from({ length: 40 }, (_, index) => makeQuestion(index, "unseen")),
    ...Array.from({ length: 20 }, (_, index) => makeQuestion(index, "strong"))
  ];
  const state: LearnerState = {
    version: 1,
    settings: { targetDate: "2026-08-31" },
    attempts: {},
    mastery: {},
    sessions: []
  };

  for (const question of groups.filter(
    (item) => !item.id.startsWith("unseen")
  )) {
    state.attempts[question.id] = [
      {
        questionId: question.id,
        answer: "a",
        correct: true,
        completedAt: "2026-07-20T08:00:00.000Z"
      }
    ];
    const concept = question.concepts[0]!;
    state.mastery[concept] = question.id.startsWith("weak")
      ? { score: 0.25, successStreak: 0, dueOn: "2026-07-30" }
      : question.id.startsWith("review")
        ? { score: 0.8, successStreak: 3, dueOn: "2026-07-30" }
        : { score: 0.9, successStreak: 4, dueOn: "2026-08-20" };
  }

  return { bank: groups, state };
}

describe("selectDailyGroup", () => {
  it("builds the 13 weak, 7 unseen, 5 review daily mix", () => {
    const { bank, state } = adaptiveFixture();
    const group = selectDailyGroup(bank, state, "2026-07-30");

    expect(group).toHaveLength(25);
    expect(new Set(group.map((question) => question.id)).size).toBe(25);
    expect(new Set(group.map((question) => question.fingerprint)).size).toBe(
      25
    );
    expect(
      group.filter((question) => question.id.startsWith("weak")).length
    ).toBeGreaterThanOrEqual(13);
    expect(
      group.filter((question) => question.id.startsWith("unseen")).length
    ).toBeGreaterThanOrEqual(7);
    expect(
      group.filter((question) => question.id.startsWith("review")).length
    ).toBeGreaterThanOrEqual(5);
    expect(new Set(group.map((question) => question.domain)).size).toBeGreaterThanOrEqual(
      3
    );
  });

  it("is reproducible for the same date and changes with the date", () => {
    const { bank, state } = adaptiveFixture();
    const first = selectDailyGroup(bank, state, "2026-07-30").map(
      (question) => question.id
    );
    const again = selectDailyGroup(bank, state, "2026-07-30").map(
      (question) => question.id
    );
    const nextDay = selectDailyGroup(bank, state, "2026-07-31").map(
      (question) => question.id
    );

    expect(again).toEqual(first);
    expect(nextDay).not.toEqual(first);
  });

  it("uses a balanced first-session diagnostic and handles small banks", () => {
    const bank = Array.from({ length: 30 }, (_, index) =>
      makeQuestion(index, "diagnostic")
    );
    const empty: LearnerState = {
      version: 1,
      settings: { targetDate: "2026-08-31" },
      attempts: {},
      mastery: {},
      sessions: []
    };
    const diagnostic = selectDailyGroup(bank, empty, "2026-07-30");
    const depleted = selectDailyGroup(bank.slice(0, 10), empty, "2026-07-30");

    expect(diagnostic).toHaveLength(25);
    expect(new Set(diagnostic.map((question) => question.domain))).toEqual(
      new Set([1, 2, 3, 4, 5])
    );
    expect(depleted).toHaveLength(10);
  });
});

describe("other group selectors", () => {
  it("selects 65 unique mock questions reproducibly", () => {
    const { bank } = adaptiveFixture();
    const mock = selectMock(bank, 65, "commute-1");

    expect(mock).toHaveLength(65);
    expect(new Set(mock.map((question) => question.id)).size).toBe(65);
    expect(selectMock(bank, 65, "commute-1")).toEqual(mock);
  });

  it("selects only questions carrying the requested source provenance", () => {
    const bank = Array.from({ length: 10 }, (_, index) =>
      makeQuestion(index, "source")
    );
    const group = selectSourceGroup(bank, "source-video");

    expect(group).toHaveLength(5);
    expect(
      group.every((question) =>
        question.sources.some((source) => source.videoId === "source-video")
      )
    ).toBe(true);
  });
});
