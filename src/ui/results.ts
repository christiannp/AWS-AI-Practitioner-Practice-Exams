import type { Answer, Question } from "../data/types";
import { scoreGroup } from "../domain/scoring";
import { escapeHtml, formatAnswer } from "./format";
import type { AppContext } from "./types";

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

function detailContent(question: Question): string {
  const distractors =
    question.type === "multiple-choice" ||
    question.type === "multiple-response"
      ? question.options.filter((option) => option.distractorReason)
      : [];
  return `
    <p class="explanation">${escapeHtml(question.explanation)}</p>
    ${
      distractors.length > 0
        ? `<h4>Why the other choices do not fit</h4>
           <ul class="distractor-list">
             ${distractors
               .map(
                 (option) =>
                   `<li><strong>${escapeHtml(
                     option.text
                   )}:</strong> ${escapeHtml(option.distractorReason ?? "")}</li>`
               )
               .join("")}
           </ul>`
        : ""
    }
    <div class="reference-list">
      ${question.verification
        .map(
          (reference) =>
            `<a href="${escapeHtml(
              reference.url
            )}" target="_blank" rel="noreferrer">Proof: ${escapeHtml(
              reference.title
            )} ↗</a>`
        )
        .join("")}
      ${question.sources
        .map(
          (source) =>
            `<a href="${escapeHtml(
              source.url
            )}" target="_blank" rel="noreferrer">Video provenance${
              source.questionNumber ? ` · Q${source.questionNumber}` : ""
            } ↗</a>`
        )
        .join("")}
    </div>
  `;
}

function reviewCard(
  question: Question,
  answer: Answer | undefined,
  position: number
): string {
  return `
    <article class="review-card is-error">
      <div class="review-heading">
        <span>Error logged</span>
        <span>${position} · Domain ${question.domain}</span>
      </div>
      <h3>${escapeHtml(question.prompt)}</h3>
      <dl class="answer-review">
        <div>
          <dt>Your answer</dt>
          <dd>${escapeHtml(formatAnswer(question, answer ?? ""))}</dd>
        </div>
        <div>
          <dt>Correct answer</dt>
          <dd>${escapeHtml(formatAnswer(question, expectedAnswer(question)))}</dd>
        </div>
      </dl>
      <details class="review-details">
        <summary>Explanation and sources</summary>
        ${detailContent(question)}
      </details>
    </article>
  `;
}

export function renderResults(
  container: HTMLElement,
  context: AppContext
): void {
  const state = context.getState();
  const latest = state.latestResult;
  if (!latest) {
    container.setAttribute("aria-labelledby", "page-title");
    container.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">No result yet</p>
        <h1 id="page-title">Submit a practice exam first.</h1>
        <a class="button-link" href="#/exams">Return to Practice Exams</a>
      </section>`;
    return;
  }

  const questions = latest.questionIds
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const wrongQuestions = latest.wrongQuestionIds
    .map((id) => context.questionById(id))
    .filter((question): question is Question => question !== undefined);
  const score = scoreGroup(questions, latest.answers);
  const examResult = state.examResults[String(latest.examId)];
  const mastered = examResult?.mastered ?? wrongQuestions.length === 0;
  const nextExam = context.examById(latest.examId + 1);

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="result-hero ${mastered ? "is-mastered" : ""}">
      <div>
        <p class="eyebrow">${
          latest.mode === "retry" ? "Retry submitted" : "Exam submitted"
        }</p>
        <h1 id="page-title">${score.percentage}%</h1>
        ${mastered ? '<strong class="result-state">Mastered</strong>' : ""}
        <p>${score.correct} correct · ${
          score.total - score.correct
        } incorrect · ${score.total} total in this round. ${
          latest.mode === "retry" && examResult
            ? `Original exam score: ${examResult.score}%.`
            : "Every incorrect response is stored only in this browser."
        }</p>
      </div>
      <div class="result-actions">
        ${
          !mastered
            ? `<button type="button" class="submit-action" data-action="continue-practice">Continue practice · ${examResult?.masteryQueue.length ?? wrongQuestions.length}</button>`
            : nextExam
              ? `<button type="button" class="submit-action" data-action="start-next-exam" data-exam-id="${nextExam.id}">Start Practice Exam ${nextExam.id}</button>`
              : ""
        }
        <a class="button-link secondary-link" href="#/exams">Return to exams</a>
        <button type="button" class="secondary-action" data-action="download-error-report">Download error report</button>
      </div>
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
          <p class="eyebrow">Review</p>
          <h2 id="review-title">${
            wrongQuestions.length > 0
              ? `${wrongQuestions.length} wrong ${wrongQuestions.length === 1 ? "answer" : "answers"}`
              : "No wrong answers remain"
          }</h2>
        </div>
      </div>
      ${
        wrongQuestions.length > 0
          ? `<div class="review-list">
              ${wrongQuestions
                .map((question, index) =>
                  reviewCard(
                    question,
                    latest.answers[question.id],
                    latest.questionIds.indexOf(question.id) + 1 || index + 1
                  )
                )
                .join("")}
            </div>`
          : `<div class="mastery-note"><strong>Queue cleared.</strong><p>You answered every missed question correctly.</p></div>`
      }
    </section>
  `;
}
