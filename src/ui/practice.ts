import type { Answer, Question } from "../data/types";
import {
  answerIsComplete,
  escapeHtml,
  initialOrderingAnswer
} from "./format";
import type { AppContext } from "./types";

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
                  name="answer-${question.id}"
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
        <p class="eyebrow">No active group</p>
        <h1 id="page-title">Ready when you are.</h1>
        <p>Start an adaptive daily group from Today or choose a mock in Library.</p>
        <a class="button-link" href="#/home">Return to Today</a>
      </section>
    `;
    return;
  }

  const questions = session.questionIds
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const index = Math.min(session.currentIndex, Math.max(questions.length - 1, 0));
  const question = questions[index];
  if (!question) {
    container.innerHTML =
      '<section class="error-panel"><h1 id="page-title">This group has no available questions.</h1></section>';
    return;
  }
  const answer = session.answers[question.id];
  const answeredCount = questions.filter(
    (item) => answerIsComplete(item, session.answers[item.id])
  ).length;
  const unansweredCount = questions.length - answeredCount;

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="practice-header">
      <div>
        <p class="eyebrow">${escapeHtml(session.mode)} practice</p>
        <h1 id="page-title">Question ${index + 1} of ${questions.length}</h1>
      </div>
      <span class="answered-chip">${answeredCount} answered</span>
      <div class="practice-progress" aria-label="${index + 1} of ${
        questions.length
      }">
        <span style="width:${((index + 1) / questions.length) * 100}%"></span>
      </div>
    </section>

    <article class="question-card" data-question-id="${escapeHtml(question.id)}">
      <div class="question-meta">
        <span>Domain ${question.domain}</span>
        <span>${escapeHtml(question.type.replace("-", " "))}</span>
      </div>
      <h2>${escapeHtml(question.prompt)}</h2>
      ${questionControl(question, answer)}
    </article>

    <div class="practice-nav">
      <button type="button" class="secondary-action" data-action="previous-question" ${
        index === 0 ? "disabled" : ""
      }>← Previous</button>
      <button type="button" class="secondary-action" data-action="next-question" ${
        index === questions.length - 1 ? "disabled" : ""
      }>Next →</button>
    </div>

    <section class="submit-zone">
      <p>${answeredCount} of ${questions.length} answered. Answers stay hidden until submission.</p>
      <button type="button" class="submit-action" data-action="submit-group">
        Submit group
      </button>
      ${
        confirmSubmission
          ? `<div class="submit-confirmation" role="alert">
              <strong>${unansweredCount} unanswered ${
                unansweredCount === 1 ? "question" : "questions"
              }.</strong>
              <p>Unanswered questions will be logged as incorrect. Submit anyway?</p>
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
