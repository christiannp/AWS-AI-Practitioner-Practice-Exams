import { describe, expect, it } from "vitest";

import type { Answer, Question } from "../src/data/types";
import { scoreAnswer } from "../src/domain/scoring";
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
});
