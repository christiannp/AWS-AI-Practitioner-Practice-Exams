import { describe, expect, it } from "vitest";

import type {
  AppContent,
  LearnerState,
  Question
} from "../src/data/types";
import { learnerErrorReportText } from "../src/domain/error-report";
import fixtureQuestions from "./fixtures/questions.json";

const questions = fixtureQuestions as unknown as Question[];
const content: AppContent = {
  questions,
  videos: [],
  cheatSheet: []
};

describe("detailed learner error report", () => {
  it("includes every incorrect attempt, including repeated errors", () => {
    const state: LearnerState = {
      version: 1,
      settings: { targetDate: "2026-08-31" },
      attempts: {
        "fixture-mc": [
          {
            questionId: "fixture-mc",
            answer: "a",
            correct: false,
            completedAt: "2026-07-28T08:00:00.000Z"
          },
          {
            questionId: "fixture-mc",
            answer: "c",
            correct: false,
            completedAt: "2026-07-29T08:00:00.000Z"
          },
          {
            questionId: "fixture-mc",
            answer: "b",
            correct: true,
            completedAt: "2026-07-30T08:00:00.000Z"
          }
        ]
      },
      mastery: {},
      sessions: []
    };

    const report = learnerErrorReportText(
      content,
      state,
      new Date("2026-07-30T09:00:00.000Z")
    );

    expect(report).toContain("Incorrect attempts: 2");
    expect(report.match(/Question ID: fixture-mc/g)).toHaveLength(2);
    expect(report).toContain("Timestamp: 2026-07-28T08:00:00.000Z");
    expect(report).toContain("Timestamp: 2026-07-29T08:00:00.000Z");
    expect(report).toContain("Your submitted answer: A. Option A");
    expect(report).toContain("Your submitted answer: C. Option C");
    expect(report).toContain("Correct answer: B. Option B");
    expect(report).toContain("Domain: 1");
    expect(report).toContain("Task: 1.1");
    expect(report).toContain("Type: multiple choice");
    expect(report).toContain(
      "Prompt: Which option is marked as correct in this scoring fixture?"
    );
    expect(report).toContain(
      "Explanation: This controlled fixture uses option B to test exact scoring."
    );
    expect(report).toContain(
      "- Fixture verification — https://example.com/fixture (verified 2026-07-29)"
    );
  });

  it("formats multiple response, ordering, and matching answers readably", () => {
    const state: LearnerState = {
      version: 1,
      settings: { targetDate: "2026-08-31" },
      attempts: {
        "fixture-mr": [
          {
            questionId: "fixture-mr",
            answer: ["b", "d"],
            correct: false,
            completedAt: "2026-07-29T08:00:00.000Z"
          }
        ],
        "fixture-ordering": [
          {
            questionId: "fixture-ordering",
            answer: ["prepare", "train", "evaluate", "collect"],
            correct: false,
            completedAt: "2026-07-29T08:01:00.000Z"
          }
        ],
        "fixture-matching": [
          {
            questionId: "fixture-matching",
            answer: { pii: "Rekognition", images: "Comprehend" },
            correct: false,
            completedAt: "2026-07-29T08:02:00.000Z"
          }
        ]
      },
      mastery: {},
      sessions: []
    };

    const report = learnerErrorReportText(
      content,
      state,
      new Date("2026-07-30T09:00:00.000Z")
    );

    expect(report).toContain(
      "Your submitted answer:\n  - B. Option B\n  - D. Option D"
    );
    expect(report).toContain(
      "Correct answer:\n  - A. Option A\n  - C. Option C"
    );
    expect(report).toContain(
      "Your submitted answer:\n  1. Prepare\n  2. Train\n  3. Evaluate\n  4. Collect"
    );
    expect(report).toContain(
      "Correct answer:\n  1. Collect\n  2. Prepare\n  3. Train\n  4. Evaluate"
    );
    expect(report).toContain(
      "Your submitted answer:\n  - PII in text → Amazon Rekognition\n  - Objects in images → Amazon Comprehend"
    );
    expect(report).toContain(
      "Correct answer:\n  - PII in text → Amazon Comprehend\n  - Objects in images → Amazon Rekognition"
    );
  });
});
