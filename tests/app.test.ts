// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppContent,
  LearnerState,
  Question,
  QuestionReview
} from "../src/data/types";
import { bootApp, type StudyApp } from "../src/main";
import { loadState, saveState } from "../src/state/storage";
import fixtureQuestions from "./fixtures/questions.json";

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

const baseQuestions = fixtureQuestions as unknown as Question[];
const extraQuestions = Array.from({ length: 61 }, (_, index) => ({
  ...baseQuestions[0]!,
  id: `fixture-extra-${index + 1}`,
  prompt: `Fixture practice question ${index + 1} has unique wording for pagination coverage.`,
  concepts: index === 0 ? ["fixture-weak"] : [`fixture-extra-${index + 1}`],
  fingerprint: `fixture-extra-${index + 1}`
})) as Question[];
const examQuestions = [...baseQuestions, ...extraQuestions];
const conflictQuestion: Question = {
  ...baseQuestions[0]!,
  id: "fixture-conflict",
  prompt:
    "A role reads an SSE-S3 encrypted object. Which permission is required?",
  concepts: ["sse-s3-object-access"],
  fingerprint: "fixture-conflict"
};

const verifiedReviews: QuestionReview[] = examQuestions.map((question) => ({
  questionId: question.id,
  status: "verified",
  reason: "The answer is supported by official AWS documentation.",
  proof: question.verification
}));
const conflictReview: QuestionReview = {
  questionId: conflictQuestion.id,
  status: "conflicted",
  reason:
    "The source incorrectly required KMS decrypt permission for SSE-S3; s3:GetObject is sufficient.",
  sourceClaim: "Grant kms:Decrypt permission.",
  proof: conflictQuestion.verification
};
const examIds = examQuestions.map((question) => question.id);
const content: AppContent = {
  questions: [...examQuestions, conflictQuestion],
  videos: [
    {
      playlistId: "fixture",
      videoId: "source-video",
      title: "Fixture source video",
      url: "https://www.youtube.com/watch?v=source-video",
      durationSeconds: 600,
      kind: "questions"
    }
  ],
  cheatSheet: [
    {
      id: "baseline-card",
      domain: 1,
      title: "Baseline foundations",
      memoryHook: "Start with the basic distinction.",
      facts: ["A baseline fact."],
      confusions: [],
      sourceUrl: "https://docs.aws.amazon.com/example/baseline",
      concepts: ["baseline"]
    },
    {
      id: "weak-card",
      domain: 2,
      title: "Weak service distinction",
      memoryHook: "Review locally missed services first.",
      facts: ["A weak-service fact."],
      confusions: ["Do not confuse the service roles."],
      sourceUrl: "https://docs.aws.amazon.com/example/weak",
      concepts: ["fixture-weak"]
    }
  ],
  exams: Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    title: `Practice Exam ${index + 1}`,
    version: 1,
    questionIds: examIds
  })),
  reviews: [...verifiedReviews, conflictReview]
};
const fixedNow = () => new Date("2026-07-29T08:00:00.000Z");

let app: StudyApp | undefined;

function emptyState(): LearnerState {
  return {
    version: 2,
    attempts: {},
    examResults: {},
    wrongHistory: []
  };
}

function click(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element, `Missing ${selector}`).not.toBeNull();
  element!.click();
}

function choose(
  root: HTMLElement,
  questionId: string,
  optionId: string
): void {
  const input = root.querySelector<HTMLInputElement>(
    `[data-question-id="${questionId}"] input[data-answer-choice][value="${optionId}"]`
  );
  expect(input).not.toBeNull();
  input!.checked = true;
  input!.dispatchEvent(new Event("change", { bubbles: true }));
}

function setMultiResponse(
  root: HTMLElement,
  questionId: string,
  optionIds: string[]
): void {
  for (const optionId of optionIds) {
    choose(root, questionId, optionId);
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "#/exams");
  window.scrollTo = vi.fn();
});

afterEach(() => {
  app?.destroy();
  app = undefined;
});

describe("three-route practice app", () => {
  it("shows only the requested bottom destinations and five local exams", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content,
      storage: new MemoryStorage(),
      now: fixedNow
    });

    expect(
      [...root.querySelectorAll(".bottom-nav a strong")].map((link) =>
        link.textContent?.trim()
      )
    ).toEqual(["Practice Exams", "Cheat Sheet", "Library"]);
    expect(root.querySelectorAll(".exam-card")).toHaveLength(5);
    expect(root.textContent).toContain("Practice Exam 1");
    expect(root.textContent).toContain("65 questions");
    expect(root.textContent).not.toMatch(
      /target date|today's questions|settings|official practice exam/i
    );
  });

  it("renders ten questions per page with the requested bottom progress copy", async () => {
    const storage = new MemoryStorage();
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="start-exam"][data-exam-id="1"]');

    expect(root.querySelectorAll(".question-card")).toHaveLength(10);
    expect(root.textContent).not.toContain("Question 1 of 65");
    expect(root.textContent).toContain("Practice Exam 1: 0 of 65 answered");
    expect(root.textContent).not.toContain("Correct answer");

    choose(root, "fixture-mc", "a");
    expect(root.textContent).toContain("Practice Exam 1: 1 of 65 answered");
    expect(loadState(storage).state.inProgress?.answers["fixture-mc"]).toBe("a");

    click('[data-action="next-page"]');
    expect(root.querySelectorAll(".question-card")).toHaveLength(10);
    expect(loadState(storage).state.inProgress?.page).toBe(1);
  });

  it("renders five questions on page seven and resumes the saved page", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "exam-1-saved",
      examId: 1,
      mode: "exam",
      questionIds: examIds,
      answers: { "fixture-mc": "a" },
      page: 6
    };
    saveState(storage, state);
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="resume-exam"][data-exam-id="1"]');

    expect(root.querySelectorAll(".question-card")).toHaveLength(5);
    expect(root.textContent).toContain("Practice Exam 1: 1 of 65 answered");
  });

  it("autosaves ordering and matching controls on a multi-question page", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "exam-controls",
      examId: 1,
      mode: "exam",
      questionIds: ["fixture-ordering", "fixture-matching"],
      answers: {},
      page: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click(
      '[data-question-id="fixture-ordering"] [data-item-id="prepare"][data-order-action="down"]'
    );
    expect(
      loadState(storage).state.inProgress?.answers["fixture-ordering"]
    ).toEqual(["train", "prepare", "evaluate", "collect"]);

    const match = root.querySelector<HTMLSelectElement>(
      '[data-question-id="fixture-matching"] [data-match-prompt="pii"]'
    )!;
    match.value = "Comprehend";
    match.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      loadState(storage).state.inProgress?.answers["fixture-matching"]
    ).toEqual({ pii: "Comprehend" });
  });

  it("confirms submission when questions remain unanswered", async () => {
    const storage = new MemoryStorage();
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });
    click('[data-action="start-exam"][data-exam-id="1"]');

    click('[data-action="submit-exam"]');

    expect(root.querySelector(".submit-confirmation")?.textContent).toContain(
      "65 unanswered questions"
    );
    expect(root.textContent).not.toContain("Correct answer");
  });
});

describe("wrong-only results and iterative practice", () => {
  it("shows a perfect percentage with correct and incorrect counts", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "exam-1-perfect",
      examId: 1,
      mode: "exam",
      questionIds: ["fixture-mc"],
      answers: { "fixture-mc": "b" },
      page: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="submit-exam"]');

    expect(root.querySelector("#page-title")?.textContent).toBe("100%");
    expect(root.textContent).toContain("Mastered");
    expect(root.textContent).toContain("1 correct");
    expect(root.textContent).toContain("0 incorrect");
  });

  it("shows only wrong answers with collapsed explanation and proof", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "exam-1-result",
      examId: 1,
      mode: "exam",
      questionIds: ["fixture-mc", "fixture-mr"],
      answers: {
        "fixture-mc": "a",
        "fixture-mr": ["a", "c"]
      },
      page: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="submit-exam"]');

    expect(root.textContent).toContain("50%");
    expect(root.querySelectorAll(".review-card")).toHaveLength(1);
    expect(root.textContent).toContain("Your answer");
    expect(root.textContent).toContain("Correct answer");
    expect(root.querySelector(".review-card details")?.hasAttribute("open")).toBe(
      false
    );
    expect(
      root.querySelector(
        '.review-card details a[href="https://example.com/fixture"]'
      )
    ).not.toBeNull();
    expect(loadState(storage).state.wrongHistory).toHaveLength(1);
  });

  it("retries only the shrinking wrong queue until mastered without replacing the original score", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "exam-1-wrong",
      examId: 1,
      mode: "exam",
      questionIds: ["fixture-mc", "fixture-mr"],
      answers: {
        "fixture-mc": "a",
        "fixture-mr": ["b", "d"]
      },
      page: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="submit-exam"]');
    expect(loadState(storage).state.examResults["1"]?.score).toBe(0);

    click('[data-action="continue-practice"]');
    expect(loadState(storage).state.inProgress?.questionIds).toEqual([
      "fixture-mc",
      "fixture-mr"
    ]);
    choose(root, "fixture-mc", "b");
    setMultiResponse(root, "fixture-mr", ["b", "d"]);
    click('[data-action="submit-exam"]');

    expect(loadState(storage).state.examResults["1"]?.masteryQueue).toEqual([
      "fixture-mr"
    ]);
    expect(loadState(storage).state.examResults["1"]?.score).toBe(0);

    click('[data-action="continue-practice"]');
    expect(loadState(storage).state.inProgress?.questionIds).toEqual([
      "fixture-mr"
    ]);
    setMultiResponse(root, "fixture-mr", ["a", "c"]);
    click('[data-action="submit-exam"]');

    expect(loadState(storage).state.examResults["1"]).toMatchObject({
      score: 0,
      mastered: true,
      masteryQueue: []
    });
    expect(root.textContent).toContain("Mastered");
    expect(loadState(storage).state.wrongHistory).toHaveLength(3);
  });

  it("does not replace another active exam from a stale result without confirmation", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.examResults["1"] = {
      examId: 1,
      score: 0,
      correct: 0,
      total: 2,
      completedAt: "2026-07-28T08:00:00.000Z",
      masteryQueue: ["fixture-mc"],
      mastered: false
    };
    state.latestResult = {
      examId: 1,
      roundId: "exam-1-old",
      mode: "exam",
      questionIds: ["fixture-mc", "fixture-mr"],
      wrongQuestionIds: ["fixture-mc"],
      answers: { "fixture-mc": "a", "fixture-mr": ["a", "c"] },
      completedAt: "2026-07-28T08:00:00.000Z",
      correct: 1
    };
    state.inProgress = {
      id: "exam-2-active",
      examId: 2,
      mode: "exam",
      questionIds: ["fixture-mc"],
      answers: { "fixture-mc": "a" },
      page: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/results");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-action="continue-practice"]');

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toMatch(/in-progress|saved answers/i);
    expect(loadState(storage).state.inProgress).toEqual(
      state.inProgress
    );
  });
});

describe("Library and Cheat Sheet", () => {
  it("shows governance counts and the corrected conflict with proof", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content,
      storage: new MemoryStorage(),
      now: fixedNow
    });

    app.navigate("library");
    expect(root.textContent).toContain("65 Verified");
    expect(root.textContent).toContain("0 Unverified");
    expect(root.textContent).toContain("1 Conflicted");

    const status = root.querySelector<HTMLSelectElement>(
      '[data-library-filter="status"]'
    )!;
    status.value = "conflicted";
    status.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.querySelectorAll(".library-question-card")).toHaveLength(1);
    expect(root.textContent).toContain("kms:Decrypt");
    expect(root.textContent).toContain("s3:GetObject");
    expect(
      root.querySelector('.library-question-card a[href="https://example.com/fixture"]')
    ).not.toBeNull();
  });

  it("labels an unverified choice as Proposed answer", async () => {
    const unverifiedReview: QuestionReview = {
      ...verifiedReviews[0]!,
      status: "unverified",
      reason: "No approved official AWS page directly establishes this answer.",
      proof: []
    };
    const unverifiedContent: AppContent = {
      ...content,
      reviews: [
        unverifiedReview,
        ...verifiedReviews.slice(1),
        conflictReview
      ]
    };
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content: unverifiedContent,
      storage: new MemoryStorage(),
      now: fixedNow
    });
    app.navigate("library");

    const status = root.querySelector<HTMLSelectElement>(
      '[data-library-filter="status"]'
    )!;
    status.value = "unverified";
    status.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.textContent).toContain("Proposed answer");
    expect(root.textContent).toContain("No approved official AWS page");
  });

  it("keeps the fixed First 20 Hours order before local mistakes", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content,
      storage: new MemoryStorage(),
      now: fixedNow
    });

    app.navigate("cheatsheet");

    expect(
      [...root.querySelectorAll(".cheat-card h2")].map((item) => item.textContent)
    ).toEqual(["Baseline foundations", "Weak service distinction"]);
    expect(root.textContent).toContain("First 20 Hours");
  });

  it("promotes cards connected to locally missed concepts", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.attempts["fixture-extra-1"] = [
      {
        questionId: "fixture-extra-1",
        answer: "a",
        correct: false,
        completedAt: "2026-07-29T08:00:00.000Z"
      }
    ];
    saveState(storage, state);
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    app.navigate("cheatsheet");

    expect(root.querySelector(".cheat-card h2")?.textContent).toBe(
      "Weak service distinction"
    );
    expect(root.querySelector(".cheat-card em")?.textContent).toContain(
      "Review priority"
    );
  });
});

describe("safe app loading", () => {
  it("renders a content-load error as text instead of executable HTML", async () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    const hostileOptions = {
      storage: new MemoryStorage(),
      get content(): AppContent {
        throw new Error('<img src="x" onerror="alert(1)">');
      }
    };

    app = await bootApp(root, hostileOptions);

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain('<img src="x" onerror="alert(1)">');
  });
});
