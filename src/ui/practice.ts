import type { Answer, Question } from "../data/types";
import {
  answerIsComplete,
  escapeHtml,
  initialOrderingAnswer
} from "./format";
import type { AppContext } from "./types";

export const QUESTIONS_PER_PAGE = 10;

export function pageQuestionIds(ids: string[], page: number): string[] {
  const start = page * QUESTIONS_PER_PAGE;
  return ids.slice(start, start + QUESTIONS_PER_PAGE);
}

function choiceControl(
  question: Extract<Question, { type: "multiple-choice" | "multiple-response" }>,
  answer: Answer | undefined
): string {
  const selected = Array.isArray(answer)
    ? new Set(answer)
    : new Set(typeof answer === "string" ? [answer] : []);
  const inputType =
    question.type === "multiple-choice" ? "radio" : "checkbox";
  const instruction =
    question.type === "multiple-response"
      ? "Select every correct answer."
      : "Select one answer.";

  return `
    <fieldset class="answer-fieldset">
      <legend>${instruction}</legend>
      <div class="choice-list">
        ${question.options
          .map(
            (option) => `
              <label class="choice-option">
                <input
                  type="${inputType}"
                  name="answer-${escapeHtml(question.id)}"
                  value="${escapeHtml(option.id)}"
                  data-answer-choice
                  data-focus-key="${escapeHtml(
                    `choice:${question.id}:${option.id}`
                  )}"
                  ${selected.has(option.id) ? "checked" : ""}
                />
                <span class="choice-letter">${option.id.toUpperCase()}</span>
                <span>${escapeHtml(option.text)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function orderingControl(
  question: Extract<Question, { type: "ordering" }>,
  answer: Answer | undefined
): string {
  const order =
    Array.isArray(answer) && answer.length === question.items.length
      ? answer
      : initialOrderingAnswer(question);
  return `
    <fieldset class="answer-fieldset">
      <legend>Arrange the items in the correct order.</legend>
      <ol class="ordering-list">
        ${order
          .map((id, index) => {
            const item = question.items.find((candidate) => candidate.id === id);
            return `<li>
              <span class="order-number">${index + 1}</span>
              <span>${escapeHtml(item?.text ?? id)}</span>
              <span class="order-actions">
                <button type="button" data-order-action="up" data-item-id="${escapeHtml(
                  id
                )}" data-focus-key="${escapeHtml(
                  `order:${question.id}:${id}:up`
                )}" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeHtml(
                  item?.text ?? id
                )} up">↑</button>
                <button type="button" data-order-action="down" data-item-id="${escapeHtml(
                  id
                )}" data-focus-key="${escapeHtml(
                  `order:${question.id}:${id}:down`
                )}" ${index === order.length - 1 ? "disabled" : ""} aria-label="Move ${escapeHtml(
                  item?.text ?? id
                )} down">↓</button>
              </span>
            </li>`;
          })
          .join("")}
      </ol>
    </fieldset>
  `;
}

function matchingControl(
  question: Extract<Question, { type: "matching" }>,
  answer: Answer | undefined
): string {
  const matches =
    typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  return `
    <fieldset class="answer-fieldset">
      <legend>Match every prompt to one target.</legend>
      <div class="matching-list">
        ${question.prompts
          .map(
            (prompt) => `
              <label>
                <span>${escapeHtml(prompt.text)}</span>
                <select
                  data-match-prompt="${escapeHtml(prompt.id)}"
                  data-focus-key="${escapeHtml(
                    `match:${question.id}:${prompt.id}`
                  )}"
                >
                  <option value="">Choose a match</option>
                  ${question.targets
                    .map(
                      (target) =>
                        `<option value="${escapeHtml(target.id)}" ${
                          matches[prompt.id] === target.id ? "selected" : ""
                        }>${escapeHtml(target.text)}</option>`
                    )
                    .join("")}
                </select>
              </label>
            `
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function questionControl(
  question: Question,
  answer: Answer | undefined
): string {
  switch (question.type) {
    case "multiple-choice":
    case "multiple-response":
      return choiceControl(question, answer);
    case "ordering":
      return orderingControl(question, answer);
    case "matching":
      return matchingControl(question, answer);
  }
}

export function renderPractice(
  container: HTMLElement,
  context: AppContext,
  confirmSubmission: boolean
): void {
  const session = context.getState().inProgress;
  if (!session) {
    container.setAttribute("aria-labelledby", "page-title");
    container.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">No active exam</p>
        <h1 id="page-title">Choose a practice exam.</h1>
        <a class="button-link" href="#/exams">Return to Practice Exams</a>
      </section>
    `;
    return;
  }

  const pageCount = Math.ceil(
    session.questionIds.length / QUESTIONS_PER_PAGE
  );
  const page = Math.min(session.page, Math.max(pageCount - 1, 0));
  const questions = pageQuestionIds(session.questionIds, page)
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const allQuestions = session.questionIds
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const answeredCount = allQuestions.filter((question) =>
    answerIsComplete(question, session.answers[question.id])
  ).length;
  const unansweredCount = allQuestions.length - answeredCount;
  const title = `Practice Exam ${session.examId}`;

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="practice-header">
      <div>
        <p class="eyebrow">${session.mode === "retry" ? "Wrong-answer retry" : "Focused practice"}</p>
        <h1 id="page-title">${title}</h1>
      </div>
      <span class="page-chip">Page ${page + 1} of ${pageCount}</span>
    </section>

    <section class="question-page" aria-label="${title}, page ${page + 1}">
      ${questions
        .map(
          (question, index) => `
            <article class="question-card" data-question-id="${escapeHtml(
              question.id
            )}">
              <div class="question-meta">
                <span>${page * QUESTIONS_PER_PAGE + index + 1}</span>
                <span>Domain ${question.domain}</span>
                <span>${escapeHtml(question.type.replace("-", " "))}</span>
              </div>
              <h2>${escapeHtml(question.prompt)}</h2>
              ${questionControl(question, session.answers[question.id])}
            </article>
          `
        )
        .join("")}
    </section>

    <section class="exam-controls" aria-label="Exam controls">
      <p>${title}: <strong>${answeredCount}</strong> of ${
        allQuestions.length
      } answered</p>
      <div>
        <button type="button" class="secondary-action" data-action="previous-page" ${
          page === 0 ? "disabled" : ""
        }>← Previous</button>
        <button type="button" class="secondary-action" data-action="next-page" ${
          page === pageCount - 1 ? "disabled" : ""
        }>Next →</button>
        <button type="button" class="submit-action" data-action="submit-exam">
          Submit
        </button>
      </div>
      ${
        confirmSubmission
          ? `<div class="submit-confirmation" role="alert">
              <strong>${unansweredCount} unanswered ${
                unansweredCount === 1 ? "question" : "questions"
              }.</strong>
              <p>Unanswered questions count as incorrect. Submit anyway?</p>
              <div>
                <button type="button" class="danger-action" data-action="confirm-submit">Submit anyway</button>
                <button type="button" class="secondary-action" data-action="cancel-submit">Keep working</button>
              </div>
            </div>`
          : ""
      }
    </section>
  `;
}
