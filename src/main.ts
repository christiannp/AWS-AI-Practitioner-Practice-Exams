import "./styles.css";

import type {
  Answer,
  AppContent,
  InProgressExam,
  LearnerState,
  Question
} from "./data/types";
import { loadContent } from "./data/load";
import { learnerErrorReportText } from "./domain/error-report";
import { scoreAnswer, scoreGroup } from "./domain/scoring";
import { loadState, saveState } from "./state/storage";
import { cheatSheetText, renderCheatSheet } from "./ui/cheatsheet";
import {
  answerIsComplete,
  escapeHtml,
  initialOrderingAnswer
} from "./ui/format";
import { renderExams } from "./ui/exams";
import { renderLibrary } from "./ui/library";
import { QUESTIONS_PER_PAGE, renderPractice } from "./ui/practice";
import { renderResults } from "./ui/results";
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
    ["exams", "practice", "results", "cheatsheet", "library"].includes(
      candidate
    )
  ) {
    return candidate as Route;
  }
  return "exams";
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function withoutInProgress(state: LearnerState): LearnerState {
  const { inProgress: _inProgress, ...rest } = state;
  return rest;
}

export async function bootApp(
  root: HTMLElement,
  options: BootOptions = {}
): Promise<StudyApp> {
  root.innerHTML = `
    <section class="loading-panel" aria-live="polite">
      <span class="loading-mark" aria-hidden="true">AIF</span>
      <p>Loading verified practice exams…</p>
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
        <p>${escapeHtml(message)}</p>
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
  let state = loadState(storage).state;
  let route = routeFromHash(window.location.hash);
  let confirmSubmission = false;
  let cheatDomain = "";
  let libraryVisible = 25;
  const libraryFilters: LibraryFilters = {
    status: "",
    domain: "",
    type: "",
    source: "",
    search: ""
  };
  const questionMap = new Map(
    content.questions.map((question) => [question.id, question])
  );
  const examMap = new Map(content.exams.map((exam) => [exam.id, exam]));
  const shell = renderShell(root);

  const context: AppContext = {
    content,
    getState: () => state,
    get today() {
      return dateKey(nowProvider());
    },
    libraryFilters,
    get libraryVisible() {
      return libraryVisible;
    },
    get cheatDomain() {
      return cheatDomain;
    },
    questionById: (id) => questionMap.get(id),
    examById: (id) => examMap.get(id)
  };

  const setState = (nextState: LearnerState): void => {
    state = nextState;
    saveState(storage, state);
  };

  const render = (): void => {
    shell.setRoute(route);
    shell.main.dataset.view = route;
    const routeTitle =
      route === "exams"
        ? "Practice Exams"
        : route === "cheatsheet"
          ? "Cheat Sheet"
          : route.charAt(0).toUpperCase() + route.slice(1);
    document.title = `${routeTitle} · AIF Field Guide`;
    switch (route) {
      case "exams":
        renderExams(shell.main, context);
        break;
      case "practice":
        renderPractice(shell.main, context, confirmSubmission);
        break;
      case "results":
        renderResults(shell.main, context);
        break;
      case "cheatsheet":
        renderCheatSheet(shell.main, context);
        break;
      case "library":
        renderLibrary(shell.main, context);
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

  const startExam = (examId: number): void => {
    const exam = examMap.get(examId);
    if (!exam) {
      shell.announce("That practice exam is unavailable.");
      return;
    }
    if (
      state.inProgress &&
      !window.confirm(
        "Replace the current in-progress exam? Its saved answers will be discarded."
      )
    ) {
      return;
    }
    setState({
      ...withoutInProgress(state),
      inProgress: {
        id: `exam-${examId}-${nowProvider().getTime()}`,
        examId,
        mode: "exam",
        questionIds: [...exam.questionIds],
        answers: {},
        page: 0
      }
    });
    navigate("practice");
  };

  const updateSession = (
    transform: (session: InProgressExam) => InProgressExam
  ): void => {
    if (!state.inProgress) return;
    setState({ ...state, inProgress: transform(state.inProgress) });
  };

  const renderAndRestoreFocus = (
    focusKey: string | undefined,
    fallbackFocusKey?: string
  ): void => {
    render();
    if (!focusKey) return;
    const controls = [
      ...root.querySelectorAll<HTMLElement>("[data-focus-key]")
    ];
    const exact = controls.find(
      (control) => control.dataset.focusKey === focusKey
    );
    const exactIsDisabled =
      exact instanceof HTMLButtonElement && exact.disabled;
    const target = exactIsDisabled
      ? controls.find(
          (control) => control.dataset.focusKey === fallbackFocusKey
        )
      : exact;
    target?.focus({ preventScroll: true });
  };

  const completeRound = (): void => {
    const active = state.inProgress;
    if (!active) return;
    const questions = active.questionIds
      .map((id) => questionMap.get(id))
      .filter((question): question is Question => question !== undefined);
    const completedAt = nowProvider().toISOString();
    const groupScore = scoreGroup(questions, active.answers);
    const wrongQuestionIds: string[] = [];
    const attempts = structuredClone(state.attempts);
    const wrongHistory = [...state.wrongHistory];

    for (const question of questions) {
      const answer = active.answers[question.id] ?? "";
      const result = scoreAnswer(question, answer);
      const attempt = {
        questionId: question.id,
        answer,
        correct: result.correct,
        completedAt
      };
      attempts[question.id] = [...(attempts[question.id] ?? []), attempt];
      if (!result.correct) {
        wrongQuestionIds.push(question.id);
        wrongHistory.push({
          ...attempt,
          examId: active.examId,
          roundId: active.id
        });
      }
    }

    const existingResult = state.examResults[String(active.examId)];
    const examResult =
      active.mode === "exam" || !existingResult
        ? {
            examId: active.examId,
            score: groupScore.percentage,
            correct: groupScore.correct,
            total: groupScore.total,
            completedAt,
            masteryQueue: wrongQuestionIds,
            mastered: wrongQuestionIds.length === 0
          }
        : {
            ...existingResult,
            masteryQueue: wrongQuestionIds,
            mastered: wrongQuestionIds.length === 0
          };
    const nextState: LearnerState = {
      ...withoutInProgress(state),
      attempts,
      examResults: {
        ...state.examResults,
        [String(active.examId)]: examResult
      },
      wrongHistory,
      latestResult: {
        examId: active.examId,
        roundId: active.id,
        mode: active.mode,
        questionIds: [...active.questionIds],
        wrongQuestionIds,
        answers: structuredClone(active.answers),
        completedAt,
        correct: groupScore.correct
      }
    };
    setState(nextState);
    shell.announce(
      `Practice Exam ${active.examId} submitted. ${groupScore.correct} of ${groupScore.total} correct.`
    );
    navigate("results");
  };

  const continuePractice = (): void => {
    const latest = state.latestResult;
    if (!latest) return;
    const result = state.examResults[String(latest.examId)];
    if (!result || result.masteryQueue.length === 0) return;
    if (
      state.inProgress &&
      !window.confirm(
        "Replace the current in-progress exam? Its saved answers will be discarded."
      )
    ) {
      return;
    }
    const questionIds = [...result.masteryQueue];
    setState({
      ...withoutInProgress(state),
      inProgress: {
        id: `retry-${latest.examId}-${nowProvider().getTime()}`,
        examId: latest.examId,
        mode: "retry",
        questionIds,
        answers: {},
        page: 0
      }
    });
    navigate("practice");
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
      const card = orderButton.closest<HTMLElement>("[data-question-id]");
      const question = questionMap.get(card?.dataset.questionId ?? "");
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
        const oppositeDirection =
          orderButton.dataset.orderAction === "up" ? "down" : "up";
        renderAndRestoreFocus(
          orderButton.dataset.focusKey,
          `order:${question.id}:${orderButton.dataset.itemId ?? ""}:${oppositeDirection}`
        );
      }
      return;
    }

    const button = target.closest<HTMLElement>("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const examId = Number(button.dataset.examId);

    if (action === "start-exam" || action === "start-next-exam") {
      startExam(examId);
    } else if (action === "resume-exam") {
      navigate("practice");
    } else if (action === "previous-page") {
      updateSession((session) => ({
        ...session,
        page: Math.max(0, session.page - 1)
      }));
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "next-page") {
      updateSession((session) => ({
        ...session,
        page: Math.min(
          Math.ceil(session.questionIds.length / QUESTIONS_PER_PAGE) - 1,
          session.page + 1
        )
      }));
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "submit-exam") {
      const questions = state.inProgress?.questionIds
        .map((id) => questionMap.get(id))
        .filter((question): question is Question => question !== undefined);
      const unanswered =
        questions?.filter(
          (question) =>
            !answerIsComplete(
              question,
              state.inProgress?.answers[question.id]
            )
        ).length ?? 0;
      if (unanswered > 0) {
        confirmSubmission = true;
        render();
      } else {
        completeRound();
      }
    } else if (action === "confirm-submit") {
      completeRound();
    } else if (action === "cancel-submit") {
      confirmSubmission = false;
      render();
    } else if (action === "continue-practice") {
      continuePractice();
    } else if (action === "show-more-library") {
      libraryVisible += 25;
      render();
    } else if (action === "download-cheatsheet") {
      triggerDownload(
        `aws-aif-cheat-sheet-${dateKey(nowProvider())}.txt`,
        cheatSheetText(context),
        "text/plain"
      );
    } else if (action === "print-cheatsheet") {
      window.print();
    } else if (action === "download-error-report") {
      triggerDownload(
        `aws-aif-learner-errors-${dateKey(nowProvider())}.txt`,
        learnerErrorReportText(content, state, nowProvider()),
        "text/plain"
      );
    }
  };

  const changeHandler = (event: Event): void => {
    const element = event.target;
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    if (element.matches("[data-answer-choice]")) {
      const card = element.closest<HTMLElement>("[data-question-id]");
      const question = questionMap.get(card?.dataset.questionId ?? "");
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
          ...(card?.querySelectorAll<HTMLInputElement>(
            "input[data-answer-choice]:checked"
          ) ?? [])
        ].map((input) => input.value);
      }
      updateSession((session) => ({
        ...session,
        answers: { ...session.answers, [question.id]: answer }
      }));
      renderAndRestoreFocus(element.dataset.focusKey);
      return;
    }

    if (element.matches("[data-match-prompt]")) {
      const card = element.closest<HTMLElement>("[data-question-id]");
      const question = questionMap.get(card?.dataset.questionId ?? "");
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
      renderAndRestoreFocus(element.dataset.focusKey);
      return;
    }

    const filter = element.dataset.libraryFilter as
      | keyof LibraryFilters
      | undefined;
    if (filter) {
      libraryFilters[filter] = element.value;
      libraryVisible = 25;
      render();
      return;
    }

    if (element.matches("[data-library-search]")) {
      libraryFilters.search = element.value;
      libraryVisible = 25;
      render();
      return;
    }

    if (element.matches("[data-cheat-domain]")) {
      cheatDomain = element.value;
      render();
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
    window.history.replaceState(null, "", "#/exams");
    route = "exams";
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

const appRoot = document.querySelector<HTMLElement>("#app");
if (appRoot) {
  void bootApp(appRoot);
}
