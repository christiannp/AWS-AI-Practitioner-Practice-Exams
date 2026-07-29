import { describe, expect, it } from "vitest";

import type { Answer, Question } from "../src/data/types";
import { scoreAnswer, scoreGroup } from "../src/domain/scoring";
import questions from "./fixtures/questions.json";

const bank = questions as Question[];

describe("scoreAnswer", () => {
  it.each([
    ["multiple-choice", "b"],
    ["multiple-response", ["a", "c"]],
    ["ordering", ["collect", "prepare", "train", "evaluate"]],
    ["matching", { pii: "Comprehend", images: "Rekognition" }]
  ] as const)("scores an exact %s response", (type, answer) => {
    const question = bank.find((item) => item.type === type)!;

    expect(scoreAnswer(question, answer as Answer).correct).toBe(true);
  });

  it("treats multiple-response selections as an exact set", () => {
    const question = bank.find(
      (item) => item.type === "multiple-response"
    )!;

    expect(scoreAnswer(question, ["c", "a"]).correct).toBe(true);
    expect(scoreAnswer(question, ["a"]).correct).toBe(false);
    expect(scoreAnswer(question, ["a", "c", "c"]).correct).toBe(false);
  });

  it("requires the exact order and every exact match", () => {
    const ordering = bank.find((item) => item.type === "ordering")!;
    const matching = bank.find((item) => item.type === "matching")!;

    expect(
      scoreAnswer(ordering, ["collect", "train", "prepare", "evaluate"])
        .correct
    ).toBe(false);
    expect(scoreAnswer(matching, { pii: "Comprehend" }).correct).toBe(false);
  });
});

describe("scoreGroup", () => {
  it("counts unanswered items as incorrect and reports every domain", () => {
    const score = scoreGroup(bank, {
      "fixture-mc": "b",
      "fixture-mr": ["c", "a"]
    });

    expect(score).toMatchObject({
      total: 4,
      correct: 2,
      percentage: 50
    });
    expect(score.byDomain[1]).toEqual({ total: 1, correct: 1 });
    expect(score.byDomain[2]).toEqual({ total: 1, correct: 1 });
    expect(score.byDomain[3]).toEqual({ total: 1, correct: 0 });
    expect(score.byDomain[4]).toEqual({ total: 0, correct: 0 });
    expect(score.byDomain[5]).toEqual({ total: 1, correct: 0 });
  });
});
