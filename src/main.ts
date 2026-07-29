import "./styles.css";

import type {
  Answer,
  AppContent,
  LearnerState,
  Question,
  StudySession
} from "./data/types";
import { loadContent } from "./data/load";
import { recordAttempt } from "./domain/mastery";
import { scoreAnswer, scoreGroup } from "./domain/scoring";
import {
  selectDailyGroup,
  selectMock,
  selectSourceGroup
} from "./domain/selector";
import {
  exportState,
  importState,
  loadState,
  resetState,
  saveState
} from "./state/storage";
import { cheatSheetText, renderCheatSheet } from "./ui/cheatsheet";
import {
  answerIsComplete,
  initialOrderingAnswer
} from "./ui/format";
import { renderHome } from "./ui/home";
import { renderLibrary } from "./ui/library";
import { renderPractice } from "./ui/practice";
import { renderResults } from "./ui/results";
import { renderSettings } from "./ui/settings";
import { renderShell } from "./ui/shell";
import type {
  AppContext,
  LibraryFilters,
  Route
} from "./ui/types";

export interface BootOptions {
  content?: AppContent;
  storage?: Storage;
  now?: () => Date;
}

export interface StudyApp {
  render(): void;
  navigate(route: Route): void;
  destroy(): void;
}

function routeFromHash(hash: string): Route {
  const candidate = hash.replace(/^#\//, "");
  if (
    [
      "home",
      "practice",
      "results",
      "library",
      "cheatsheet",
      "settings"
    ].includes(candidate)
  ) {
    return candidate as Route;
  }
  return "home";
}

function withoutInProgress(state: LearnerState): LearnerState {
  const { inProgress: _inProgress, ...rest } = state;
  return rest;
}

function triggerDownload(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sessionQuestions(
  content: AppContent,
  state: LearnerState
): Question[] {
  if (!state.inProgress) return [];
  const questionMap = new Map(
    content.questions.map((question) => [question.id, question])
  );
  return state.inProgress.questionIds
    .map((id) => questionMap.get(id))
    .filter((question): question is Question => question !== undefined);
}

export async function bootApp(
  root: HTMLElement,
  options: BootOptions = {}
): Promise<StudyApp> {
  root.innerHTML = `
    <section class="loading-panel" aria-live="polite">
      <span class="loading-mark" aria-hidden="true">AIF</span>
      <p>Loading verified practice bank…</p>
    </section>
  `;

  let content: AppContent;
  try {
    content = options.content ?? (await loadContent());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Study content failed to load.";
    root.innerHTML = `
      <section class="error-panel" aria-labelledby="load-error-title">
        <p class="eyebrow">Content unavailable</p>
        <h1 id="load-error-title">The practice bank could not load.</h1>
        <p>${message}</p>
        <button type="button" class="primary-small" onclick="location.reload()">Retry</button>
      </section>
    `;
    return {
      render() {},
      navigate() {},
      destroy() {}
    };
  }

  const storage = options.storage ?? window.localStorage;
  const nowProvider = options.now ?? (() => new Date());
  const loaded = loadState(storage);
  let state = loaded.state;
  let route = routeFromHash(window.location.hash);
  let confirmSubmission = false;
  let confirmReset = false;
  let importError = "";
  let cheatDomain = "";
  const libraryFilters: LibraryFilters = {
    domain: "",
    type: "",
    attempt: "",
    source: ""
  };
  const now = nowProvider();
  const today = now.toISOString().slice(0, 10);
  const questionMap = new Map(
    content.questions.map((question) => [question.id, question])
  );
  const shell = renderShell(root, state);

  const context: AppContext = {
    content,
    getState: () => state,
    today,
    now,
    libraryFilters,
    get cheatDomain() {
      return cheatDomain;
    },
    questionById: (id) => questionMap.get(id)
  };
  if (loaded.recoveryPayload !== undefined) {
    context.recoveryPayload = loaded.recoveryPayload;
  }

  const setState = (nextState: LearnerState): void => {
    state = nextState;
    saveState(storage, state);
    shell.updateTarget(state);
  };

  const render = (): void => {
    shell.setRoute(route);
    document.title = `${
      route === "home"
        ? "Today"
        : `${route.charAt(0).toUpperCase()}${route.slice(1)}`
    } · AIF Field Guide`;
    switch (route) {
      case "home":
        renderHome(shell.main, context);
        break;
      case "practice":
        renderPractice(shell.main, context, confirmSubmission);
        break;
      case "results":
        renderResults(shell.main, context);
        break;
      case "library":
        renderLibrary(shell.main, context);
        break;
      case "cheatsheet":
        renderCheatSheet(shell.main, context);
        break;
      case "settings":
        renderSettings(
          shell.main,
          context,
          confirmReset,
          importError
        );
        break;
    }
  };

  const navigate = (nextRoute: Route): void => {
    route = nextRoute;
    confirmSubmission = false;
    window.history.pushState(null, "", `#/${nextRoute}`);
    render();
    shell.main.focus({ preventScroll: true });
  };

  const startSession = (
    mode: StudySession["mode"],
    questions: Question[]
  ): void => {
    if (questions.length === 0) {
      shell.announce("No questions are available for that selection.");
      return;
    }
    const sessionId = `${mode}-${today}-${nowProvider().getTime()}`;
    setState({
      ...state,
      inProgress: {
        id: sessionId,
        mode,
        questionIds: questions.map((question) => question.id),
        answers: {},
        currentIndex: 0
      }
    });
    navigate("practice");
  };

  const updateSession = (
    transform: (
      session: NonNullable<LearnerState["inProgress"]>
    ) => NonNullable<LearnerState["inProgress"]>
  ): void => {
    if (!state.inProgress) return;
    setState({ ...state, inProgress: transform(state.inProgress) });
  };

  const completeSession = (): void => {
    const active = state.inProgress;
    if (!active || state.sessions.some((session) => session.id === active.id)) {
      return;
    }
    const questions = sessionQuestions(content, state);
    const completedAt = nowProvider().toISOString();
    const groupScore = scoreGroup(questions, active.answers);
    let nextState = state;
    for (const question of questions) {
      const answer = active.answers[question.id] ?? "";
      const result = scoreAnswer(question, answer);
      nextState = recordAttempt(
        nextState,
        question,
        result.correct,
        completedAt,
        answer
      );
    }
    const completedSession: StudySession = {
      id: active.id,
      mode: active.mode,
      questionIds: active.questionIds,
      completedAt,
      correctCount: groupScore.correct
    };
    nextState = {
      ...withoutInProgress(nextState),
      sessions: [...nextState.sessions, completedSession]
    };
    setState(nextState);
    shell.announce(
      `Group submitted. ${groupScore.correct} of ${groupScore.total} correct.`
    );
    navigate("results");
  };

  const currentQuestion = (): Question | undefined => {
    const active = state.inProgress;
    if (!active) return undefined;
    return questionMap.get(active.questionIds[active.currentIndex] ?? "");
  };

  const clickHandler = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const routeLink = target.closest<HTMLAnchorElement>('a[href^="#/"]');
    if (routeLink) {
      event.preventDefault();
      navigate(routeFromHash(routeLink.getAttribute("href") ?? ""));
      return;
    }
    const orderButton = target.closest<HTMLElement>("[data-order-action]");
    if (orderButton) {
      const question = currentQuestion();
      const active = state.inProgress;
      if (!active || !question || question.type !== "ordering") return;
      const current =
        Array.isArray(active.answers[question.id]) &&
        (active.answers[question.id] as string[]).length === question.items.length
          ? [...(active.answers[question.id] as string[])]
          : initialOrderingAnswer(question);
      const itemIndex = current.indexOf(orderButton.dataset.itemId ?? "");
      const direction = orderButton.dataset.orderAction === "up" ? -1 : 1;
      const targetIndex = itemIndex + direction;
      if (
        itemIndex >= 0 &&
        targetIndex >= 0 &&
        targetIndex < current.length
      ) {
        [current[itemIndex], current[targetIndex]] = [
          current[targetIndex]!,
          current[itemIndex]!
        ];
        updateSession((session) => ({
          ...session,
          answers: { ...session.answers, [question.id]: current }
        }));
        render();
      }
      return;
    }
    const button = target.closest<HTMLElement>("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "start-daily") {
      if (
        state.inProgress &&
        !window.confirm(
          "Replace the current in-progress group with today's selection?"
        )
      ) {
        return;
      }
      startSession(
        "daily",
        selectDailyGroup(content.questions, state, today, 25)
      );
    } else if (action === "resume-session") {
      navigate("practice");
    } else if (action === "previous-question") {
      updateSession((session) => ({
        ...session,
        currentIndex: Math.max(0, session.currentIndex - 1)
      }));
      render();
    } else if (action === "next-question") {
      updateSession((session) => ({
        ...session,
        currentIndex: Math.min(
          session.questionIds.length - 1,
          session.currentIndex + 1
        )
      }));
      render();
    } else if (action === "submit-group") {
      const questions = sessionQuestions(content, state);
      const unanswered = questions.filter((question) =>
        !answerIsComplete(question, state.inProgress?.answers[question.id])
      ).length;
      if (unanswered > 0) {
        confirmSubmission = true;
        render();
      } else {
        completeSession();
      }
    } else if (action === "confirm-submit") {
      completeSession();
    } else if (action === "cancel-submit") {
      confirmSubmission = false;
      render();
    } else if (action === "start-mock") {
      startSession(
        "mock",
        selectMock(
          content.questions,
          65,
          `${today}-${state.sessions.length}`
        )
      );
    } else if (action === "start-source") {
      startSession(
        "source",
        selectSourceGroup(content.questions, libraryFilters.source)
      );
    } else if (action === "download-cheatsheet") {
      triggerDownload(
        `aws-aif-cheat-sheet-${today}.txt`,
        cheatSheetText(context),
        "text/plain"
      );
    } else if (action === "print-cheatsheet") {
      window.print();
    } else if (action === "export-progress") {
      triggerDownload(
        `aws-aif-progress-${today}.json`,
        exportState(state),
        "application/json"
      );
    } else if (action === "download-recovery" && context.recoveryPayload) {
      triggerDownload(
        `aws-aif-recovery-${today}.txt`,
        context.recoveryPayload,
        "text/plain"
      );
    } else if (action === "request-reset") {
      confirmReset = true;
      render();
    } else if (action === "cancel-reset") {
      confirmReset = false;
      render();
    } else if (action === "confirm-reset") {
      state = resetState(storage);
      confirmReset = false;
      shell.updateTarget(state);
      shell.announce("Local study progress was reset.");
      navigate("home");
    }

  };

  const changeHandler = (event: Event): void => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) {
      return;
    }

    if (element.matches("[data-answer-choice]")) {
      const question = currentQuestion();
      if (
        !question ||
        (question.type !== "multiple-choice" &&
          question.type !== "multiple-response")
      ) {
        return;
      }
      let answer: Answer;
      if (question.type === "multiple-choice") {
        answer = element.value;
      } else {
        answer = [
          ...root.querySelectorAll<HTMLInputElement>(
            "input[data-answer-choice]:checked"
          )
        ]
          .filter((input) => input.name === `answer-${question.id}`)
          .map((input) => input.value);
      }
      updateSession((session) => ({
        ...session,
        answers: { ...session.answers, [question.id]: answer }
      }));
      render();
      return;
    }

    if (element.matches("[data-match-prompt]")) {
      const question = currentQuestion();
      const active = state.inProgress;
      if (!active || !question || question.type !== "matching") return;
      const existing = active.answers[question.id];
      const matches =
        typeof existing === "object" && !Array.isArray(existing)
          ? { ...existing }
          : {};
      const promptId = element.dataset.matchPrompt ?? "";
      if (element.value) matches[promptId] = element.value;
      else delete matches[promptId];
      updateSession((session) => ({
        ...session,
        answers: { ...session.answers, [question.id]: matches }
      }));
      render();
      return;
    }

    const filter = element.dataset.libraryFilter as
      | keyof LibraryFilters
      | undefined;
    if (filter) {
      libraryFilters[filter] = element.value;
      render();
      return;
    }

    if (element.matches("[data-cheat-domain]")) {
      cheatDomain = element.value;
      render();
      return;
    }

    if (element.matches("[data-target-date]")) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(element.value)) {
        setState({
          ...state,
          settings: { ...state.settings, targetDate: element.value }
        });
        shell.announce("Target date updated.");
        render();
      }
      return;
    }

    if (
      element instanceof HTMLInputElement &&
      element.matches("[data-import-progress]") &&
      element.files?.[0]
    ) {
      const file = element.files[0];
      void file.text().then((text) => {
        try {
          const imported = importState(text);
          if (
            window.confirm(
              "Replace all current local progress with this backup?"
            )
          ) {
            setState(imported);
            importError = "";
            shell.announce("Progress backup imported.");
            render();
          }
        } catch (error) {
          importError =
            error instanceof Error ? error.message : "Import failed.";
          render();
        }
      });
    }
  };

  const hashHandler = (): void => {
    route = routeFromHash(window.location.hash);
    render();
  };

  root.addEventListener("click", clickHandler);
  root.addEventListener("change", changeHandler);
  window.addEventListener("hashchange", hashHandler);

  if (!window.location.hash) {
    window.history.replaceState(null, "", "#/home");
    route = "home";
  }
  render();

  return {
    render,
    navigate,
    destroy() {
      root.removeEventListener("click", clickHandler);
      root.removeEventListener("change", changeHandler);
      window.removeEventListener("hashchange", hashHandler);
    }
  };
}

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  void bootApp(root);
}
