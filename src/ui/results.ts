import type { Answer, Question, StudySession } from "../data/types";
import { scoreAnswer, scoreGroup } from "../domain/scoring";
import { escapeHtml, formatAnswer } from "./format";
import type { AppContext } from "./types";

function sessionAnswer(
  context: AppContext,
  session: StudySession,
  questionId: string
): Answer {
  const attempts = context.getState().attempts[questionId] ?? [];
  return (
    [...attempts]
      .reverse()
      .find((attempt) => attempt.completedAt === session.completedAt)?.answer ??
    ""
  );
}

function expectedAnswer(question: Question): Answer {
  switch (question.type) {
    case "multiple-choice":
      return question.correctId;
    case "multiple-response":
      return question.correctIds;
    case "ordering":
      return question.correctOrder;
    case "matching":
      return question.correctMatches;
  }
}

function distractorReasons(question: Question): string {
  if (question.type !== "multiple-choice" && question.type !== "multiple-response") {
    return "";
  }
  const reasons = question.options.filter(
    (option) => option.distractorReason
  );
  if (reasons.length === 0) return "";
  return `
    <details class="distractor-notes">
      <summary>Why the other choices do not fit</summary>
      <ul>
        ${reasons
          .map(
            (option) =>
              `<li><strong>${escapeHtml(option.text)}:</strong> ${escapeHtml(
                option.distractorReason ?? ""
              )}</li>`
          )
          .join("")}
      </ul>
    </details>
  `;
}

function reviewCard(
  context: AppContext,
  session: StudySession,
  question: Question,
  index: number
): string {
  const received = sessionAnswer(context, session, question.id);
  const result = scoreAnswer(question, received);
  return `
    <article class="review-card ${result.correct ? "is-correct" : "is-error"}">
      <div class="review-heading">
        <span>${result.correct ? "Correct" : "Error logged"}</span>
        <span>Question ${index + 1} · Domain ${question.domain}</span>
      </div>
      <h3>${escapeHtml(question.prompt)}</h3>
      <dl class="answer-review">
        <div>
          <dt>Your answer</dt>
          <dd>${escapeHtml(formatAnswer(question, received))}</dd>
        </div>
        <div>
          <dt>Correct answer</dt>
          <dd>${escapeHtml(formatAnswer(question, expectedAnswer(question)))}</dd>
        </div>
      </dl>
      <p class="explanation">${escapeHtml(question.explanation)}</p>
      ${distractorReasons(question)}
      <div class="reference-list">
        ${question.verification
          .map(
            (reference) =>
              `<a href="${escapeHtml(
                reference.url
              )}" target="_blank" rel="noreferrer">Verify: ${escapeHtml(
                reference.title
              )}</a>`
          )
          .join("")}
        ${question.sources
          .slice(0, 4)
          .map(
            (source) =>
              `<a href="${escapeHtml(
                source.url
              )}" target="_blank" rel="noreferrer">Video source ${
                source.questionNumber ? `Q${source.questionNumber}` : ""
              }</a>`
          )
          .join("")}
      </div>
    </article>
  `;
}

export function renderResults(
  container: HTMLElement,
  context: AppContext
): void {
  const session = context.getState().sessions.at(-1);
  if (!session) {
    container.setAttribute("aria-labelledby", "page-title");
    container.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">No result yet</p>
        <h1 id="page-title">Finish a group first.</h1>
        <a class="button-link" href="#/home">Start from Today</a>
      </section>`;
    return;
  }

  const questions = session.questionIds
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const answers = Object.fromEntries(
    questions.map((question) => [
      question.id,
      sessionAnswer(context, session, question.id)
    ])
  );
  const score = scoreGroup(questions, answers);

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="result-hero">
      <div>
        <p class="eyebrow">Group complete</p>
        <h1 id="page-title">${score.percentage}%</h1>
        <p>${score.correct} correct of ${score.total}. Every incorrect response is saved in your local error history.</p>
      </div>
      <a class="button-link" href="#/home">Return to Today</a>
    </section>

    <section class="domain-score-grid" aria-label="Scores by domain">
      ${([1, 2, 3, 4, 5] as const)
        .map((domain) => {
          const item = score.byDomain[domain];
          return `<article>
            <span>D${domain}</span>
            <strong>${item.correct}/${item.total}</strong>
          </article>`;
        })
        .join("")}
    </section>

    <section class="review-section" aria-labelledby="review-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">After-submit review</p>
          <h2 id="review-title">Answers and explanations</h2>
        </div>
      </div>
      <div class="review-list">
        ${questions
          .map((question, index) =>
            reviewCard(context, session, question, index)
          )
          .join("")}
      </div>
    </section>
  `;
}
