// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppContent,
  LearnerState,
  Question
} from "../src/data/types";
import { bootApp, type StudyApp } from "../src/main";
import {
  loadState,
  RECOVERY_KEY,
  saveState,
  STORAGE_KEY
} from "../src/state/storage";
import cheatSheet from "../public/data/cheat-sheet.json";
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

const questions = fixtureQuestions as unknown as Question[];
const content: AppContent = {
  questions,
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
  cheatSheet: cheatSheet as AppContent["cheatSheet"]
};
const fixedNow = () => new Date("2026-07-29T08:00:00.000Z");

let app: StudyApp | undefined;

function emptyState(): LearnerState {
  return {
    version: 1,
    settings: { targetDate: "2026-08-31" },
    attempts: {},
    mastery: {},
    sessions: []
  };
}

function click(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element, `Missing ${selector}`).not.toBeNull();
  element!.click();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "#/home");
  vi.restoreAllMocks();
});

afterEach(() => {
  app?.destroy();
  app = undefined;
});

describe("daily phone flow", () => {
  it("renders the current target and starts an answer-hidden group", async () => {
    const storage = new MemoryStorage();
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    expect(root.querySelector("main")?.getAttribute("aria-labelledby")).toBe(
      "page-title"
    );
    expect(root.textContent).toContain("August 31, 2026");
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="start-daily"]')
        ?.textContent
    ).toContain("Start today's 25 questions");

    click('[data-action="start-daily"]');

    expect(root.textContent).toContain("Question 1 of 4");
    expect(root.textContent).not.toContain("Correct answer");
    expect(root.querySelector(".explanation")).toBeNull();
    expect(root.querySelector(".is-correct")).toBeNull();

    const radio = root.querySelector<HTMLInputElement>(
      'input[data-answer-choice][value="b"]'
    )!;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));

    expect(root.textContent).toContain("1 answered");
    click('[data-action="next-question"]');
    click('[data-action="previous-question"]');
    expect(
      root.querySelector<HTMLInputElement>(
        'input[data-answer-choice][value="b"]'
      )?.checked
    ).toBe(true);
  });

  it("autosaves ordering and matching controls and confirms incomplete submit", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "daily-controls",
      mode: "daily",
      questionIds: ["fixture-ordering", "fixture-matching"],
      answers: {},
      currentIndex: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    click('[data-item-id="prepare"][data-order-action="down"]');
    expect(
      loadState(storage).state.inProgress?.answers["fixture-ordering"]
    ).toEqual(["train", "prepare", "evaluate", "collect"]);

    click('[data-action="next-question"]');
    const match = root.querySelector<HTMLSelectElement>("[data-match-prompt]")!;
    match.value = "Comprehend";
    match.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      loadState(storage).state.inProgress?.answers["fixture-matching"]
    ).toEqual({ pii: "Comprehend" });

    click('[data-action="submit-group"]');
    expect(root.querySelector(".submit-confirmation")?.textContent).toContain(
      "1 unanswered question"
    );
    expect(root.textContent).not.toContain("Correct answer");
  });

  it("restores the exact radio, checkbox, and matching control after autosave rerenders", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "focus-controls",
      mode: "daily",
      questionIds: ["fixture-mc", "fixture-mr", "fixture-matching"],
      answers: {},
      currentIndex: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    const radio = root.querySelector<HTMLInputElement>(
      'input[data-answer-choice][value="a"]'
    )!;
    radio.focus();
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.activeElement).toBe(
      root.querySelector('input[data-answer-choice][value="a"]')
    );

    click('[data-action="next-question"]');
    const checkbox = root.querySelector<HTMLInputElement>(
      'input[data-answer-choice][value="d"]'
    )!;
    checkbox.focus();
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.activeElement).toBe(
      root.querySelector('input[data-answer-choice][value="d"]')
    );

    click('[data-action="next-question"]');
    const match = root.querySelector<HTMLSelectElement>(
      '[data-match-prompt="images"]'
    )!;
    match.focus();
    match.value = "Rekognition";
    match.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.activeElement).toBe(
      root.querySelector('[data-match-prompt="images"]')
    );
  });

  it("logs a wrong answer once and reveals explanations only in results", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.inProgress = {
      id: "daily-result",
      mode: "daily",
      questionIds: ["fixture-mc"],
      answers: { "fixture-mc": "a" },
      currentIndex: 0
    };
    saveState(storage, state);
    window.history.replaceState(null, "", "#/practice");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    expect(root.textContent).not.toContain(
      "This controlled fixture uses option B"
    );
    click('[data-action="submit-group"]');

    const saved = loadState(storage).state;
    expect(saved.sessions).toHaveLength(1);
    expect(saved.attempts["fixture-mc"]).toEqual([
      {
        questionId: "fixture-mc",
        answer: "a",
        correct: false,
        completedAt: "2026-07-29T08:00:00.000Z"
      }
    ]);
    expect(root.textContent).toContain("Error logged");
    expect(root.textContent).toContain("Correct answer");
    expect(root.textContent).toContain(
      "This controlled fixture uses option B"
    );
    expect(root.querySelector('a[href="https://example.com/fixture"]')).not.toBeNull();
  });
});

describe("library, cheat sheet, and settings", () => {
  it("starts a unique 65-question untimed mock", async () => {
    const largeBank = Array.from({ length: 70 }, (_, index) => ({
      ...questions[0]!,
      id: `mock-${index}`,
      prompt: `Mock fixture question number ${index} has unique wording for selection.`,
      domain: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      fingerprint: `mock-fingerprint-${index}`
    }));
    const storage = new MemoryStorage();
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content: { ...content, questions: largeBank },
      storage,
      now: fixedNow
    });

    app.navigate("library");
    expect(root.textContent).toContain("no timer");
    click('[data-action="start-mock"]');

    const ids = loadState(storage).state.inProgress?.questionIds ?? [];
    expect(ids).toHaveLength(65);
    expect(new Set(ids).size).toBe(65);
    expect(root.textContent).not.toContain("Correct answer");
  });

  it("filters memory notes and updates the editable target date", async () => {
    const storage = new MemoryStorage();
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    app.navigate("cheatsheet");
    const domain = root.querySelector<HTMLSelectElement>(
      "[data-cheat-domain]"
    )!;
    domain.value = "5";
    domain.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      [...root.querySelectorAll(".cheat-card-heading span")].every(
        (item) => item.textContent === "D5"
      )
    ).toBe(true);

    app.navigate("settings");
    const date = root.querySelector<HTMLInputElement>("[data-target-date]")!;
    date.value = "2026-08-30";
    date.dispatchEvent(new Event("change", { bubbles: true }));
    expect(loadState(storage).state.settings.targetDate).toBe("2026-08-30");

    click('[data-action="request-reset"]');
    expect(root.querySelector(".reset-confirmation")).not.toBeNull();
    click('[data-action="cancel-reset"]');
    expect(root.querySelector(".reset-confirmation")).toBeNull();
  });

  it.each([
    ["daily", '[data-action="start-daily"]'],
    ["mock", '[data-action="start-mock"]'],
    ["source", '[data-action="start-source"]']
  ])(
    "guards replacement from the %s launch with one confirmation",
    async (mode, action) => {
      const guardedQuestions = Array.from({ length: 70 }, (_, index) => ({
        ...questions[index % questions.length]!,
        id: `guard-${index}`,
        prompt: `Guard fixture ${index} keeps a unique verified question.`,
        fingerprint: `guard-${index}`,
        sources: [
          {
            playlistId: "fixture",
            videoId: "source-video",
            videoTitle: "Fixture source video",
            url: "https://www.youtube.com/watch?v=source-video"
          }
        ]
      }));
      const storage = new MemoryStorage();
      const state = emptyState();
      state.inProgress = {
        id: "keep-this-session",
        mode: "daily",
        questionIds: [guardedQuestions[0]!.id],
        answers: { [guardedQuestions[0]!.id]: "a" },
        currentIndex: 0
      };
      saveState(storage, state);
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const root = document.querySelector<HTMLElement>("#app")!;
      app = await bootApp(root, {
        content: { ...content, questions: guardedQuestions },
        storage,
        now: fixedNow
      });

      if (mode !== "daily") app.navigate("library");
      if (mode === "source") {
        const source = root.querySelector<HTMLSelectElement>(
          '[data-library-filter="source"]'
        )!;
        source.value = "source-video";
        source.dispatchEvent(new Event("change", { bubbles: true }));
      }
      click(action);

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0]?.[0]).toMatch(/in-progress|saved answers/i);
      expect(loadState(storage).state.inProgress).toMatchObject({
        mode,
        answers: {}
      });
      expect(loadState(storage).state.inProgress?.id).not.toBe(
        state.inProgress.id
      );
    }
  );

  it("refreshes the local day when date-sensitive UI rerenders after midnight", async () => {
    let current = new Date(2026, 6, 29, 23, 59);
    const storage = new MemoryStorage();
    const state = emptyState();
    state.settings.targetDate = "2026-07-31";
    saveState(storage, state);
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, {
      content,
      storage,
      now: () => current
    });

    expect(root.querySelector(".quick-stats strong")?.textContent).toBe("2");
    current = new Date(2026, 6, 30, 0, 1);
    app.render();
    expect(root.querySelector(".quick-stats strong")?.textContent).toBe("1");
  });

  it("offers an accessible download for the complete detailed error report", async () => {
    const storage = new MemoryStorage();
    const state = emptyState();
    state.attempts["fixture-mc"] = [
      {
        questionId: "fixture-mc",
        answer: "a",
        correct: false,
        completedAt: "2026-07-29T08:00:00.000Z"
      }
    ];
    saveState(storage, state);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => ""
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => {}
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:learner-errors");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    app.navigate("settings");
    const download = [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.match(/detailed error report/i));
    expect(download).toBeDefined();
    download!.click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("keeps corrupt recovery through saves and reloads until explicit discard", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{broken progress");
    const root = document.querySelector<HTMLElement>("#app")!;
    app = await bootApp(root, { content, storage, now: fixedNow });

    app.navigate("settings");
    expect(root.textContent).toContain("Unrecognized local data");
    const date = root.querySelector<HTMLInputElement>("[data-target-date]")!;
    date.value = "2026-08-30";
    date.dispatchEvent(new Event("change", { bubbles: true }));
    app.destroy();

    app = await bootApp(root, { content, storage, now: fixedNow });
    app.navigate("settings");
    expect(root.textContent).toContain("Unrecognized local data");
    expect(storage.getItem(RECOVERY_KEY)).toBe("{broken progress");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    click('[data-action="discard-recovery"]');
    expect(root.textContent).not.toContain("Unrecognized local data");
    expect(storage.getItem(RECOVERY_KEY)).toBeNull();
  });
});
