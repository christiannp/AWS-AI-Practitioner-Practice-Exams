import type { Answer, Question, QuestionReview } from "../data/types";
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

function proofLinks(review: QuestionReview): string {
  if (review.proof.length === 0) return "";
  return `
    <div class="reference-list">
      ${review.proof
        .map(
          (proof) =>
            `<a href="${escapeHtml(
              proof.url
            )}" target="_blank" rel="noreferrer">Proof: ${escapeHtml(
              proof.title
            )} ↗</a>`
        )
        .join("")}
    </div>
  `;
}

function sourceLinks(question: Question): string {
  if (question.sources.length === 0) return "";
  return `
    <div class="reference-list source-reference-list">
      ${question.sources
        .map(
          (source) =>
            `<a href="${escapeHtml(
              source.url
            )}" target="_blank" rel="noreferrer">${escapeHtml(
              source.videoTitle
            )}${source.questionNumber ? ` · Q${source.questionNumber}` : ""} ↗</a>`
        )
        .join("")}
    </div>
  `;
}

function questionCard(question: Question, review: QuestionReview): string {
  const answerLabel =
    review.status === "unverified" ? "Proposed answer" : "Correct answer";
  return `
    <article class="library-question-card status-${review.status}" data-question-id="${escapeHtml(
      question.id
    )}">
      <div class="library-card-heading">
        <span class="status-badge">${escapeHtml(review.status)}</span>
        <span>D${question.domain} · ${escapeHtml(
          question.type.replace("-", " ")
        )}</span>
      </div>
      <h3>${escapeHtml(question.prompt)}</h3>
      <dl class="answer-review library-answer">
        <div>
          <dt>${answerLabel}</dt>
          <dd>${escapeHtml(formatAnswer(question, expectedAnswer(question)))}</dd>
        </div>
      </dl>
      <p class="review-reason">${escapeHtml(review.reason)}</p>
      ${
        review.status === "conflicted"
          ? `<div class="conflict-claim">
              <strong>Source claim</strong>
              <p>${escapeHtml(review.sourceClaim ?? "The source answer conflicts with official AWS documentation.")}</p>
            </div>`
          : ""
      }
      ${proofLinks(review)}
      ${review.status === "conflicted" ? sourceLinks(question) : ""}
    </article>
  `;
}

export function renderLibrary(
  container: HTMLElement,
  context: AppContext
): void {
  const filters = context.libraryFilters;
  const reviewById = new Map(
    context.content.reviews.map((review) => [review.questionId, review])
  );
  const counts = {
    verified: context.content.reviews.filter(
      (review) => review.status === "verified"
    ).length,
    unverified: context.content.reviews.filter(
      (review) => review.status === "unverified"
    ).length,
    conflicted: context.content.reviews.filter(
      (review) => review.status === "conflicted"
    ).length
  };
  const normalizedSearch = filters.search.trim().toLowerCase();
  const questions = context.content.questions.filter((question) => {
    const review = reviewById.get(question.id);
    if (!review) return false;
    if (filters.status && review.status !== filters.status) return false;
    if (filters.domain && String(question.domain) !== filters.domain) {
      return false;
    }
    if (filters.type && question.type !== filters.type) return false;
    if (
      filters.source &&
      !question.sources.some((source) => source.videoId === filters.source)
    ) {
      return false;
    }
    if (
      normalizedSearch &&
      ![
        question.prompt,
        question.task,
        ...question.concepts,
        ...question.services
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    ) {
      return false;
    }
    return true;
  });
  const visibleQuestions = questions.slice(0, context.libraryVisible);
  const sourceVideos = context.content.videos.filter(
    (video) => video.kind === "questions"
  );

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro library-intro">
      <p class="eyebrow">Library</p>
      <h1 id="page-title">Every answer has a status.</h1>
      <p>Inspect the full question bank, the verification decision, and the source used as proof.</p>
    </section>

    <section class="review-status-grid" aria-label="Question review status">
      <article class="status-verified"><strong>${counts.verified} Verified</strong><span>Official AWS proof supports the app answer.</span></article>
      <article class="status-unverified"><strong>${counts.unverified} Unverified</strong><span>No authoritative proof established.</span></article>
      <article class="status-conflicted"><strong>${counts.conflicted} Conflicted</strong><span>Source answer corrected using AWS proof.</span></article>
    </section>

    <section class="filter-panel" aria-labelledby="filter-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Dashboard controls</p>
          <h2 id="filter-title">Filter ${context.content.questions.length} questions</h2>
        </div>
        <button type="button" class="secondary-action" data-action="download-error-report">Download my error report</button>
      </div>
      <div class="filter-grid">
        <label>Review status
          <select data-library-filter="status">
            ${[
              ["", "All statuses"],
              ["verified", "Verified"],
              ["unverified", "Unverified"],
              ["conflicted", "Conflicted"]
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${
                    filters.status === value ? "selected" : ""
                  }>${label}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>Domain
          <select data-library-filter="domain">
            <option value="">All domains</option>
            ${[1, 2, 3, 4, 5]
              .map(
                (domain) =>
                  `<option value="${domain}" ${
                    filters.domain === String(domain) ? "selected" : ""
                  }>Domain ${domain}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>Format
          <select data-library-filter="type">
            <option value="">All formats</option>
            ${[
              "multiple-choice",
              "multiple-response",
              "ordering",
              "matching"
            ]
              .map(
                (type) =>
                  `<option value="${type}" ${
                    filters.type === type ? "selected" : ""
                  }>${type.replace("-", " ")}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>Video source
          <select data-library-filter="source">
            <option value="">All videos</option>
            ${sourceVideos
              .map(
                (video) =>
                  `<option value="${escapeHtml(video.videoId)}" ${
                    filters.source === video.videoId ? "selected" : ""
                  }>${escapeHtml(video.title)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="search-filter">Search
          <input
            type="search"
            value="${escapeHtml(filters.search)}"
            placeholder="Question, service, concept"
            data-library-search
          />
        </label>
      </div>
    </section>

    <section class="library-results" aria-labelledby="library-results-title">
      <div class="section-heading">
        <h2 id="library-results-title">${questions.length} matching questions</h2>
        <span>Showing ${visibleQuestions.length}</span>
      </div>
      <div class="library-question-list">
        ${visibleQuestions
          .map((question) => {
            const review = reviewById.get(question.id);
            return review ? questionCard(question, review) : "";
          })
          .join("")}
      </div>
      ${
        visibleQuestions.length < questions.length
          ? `<button type="button" class="secondary-action show-more-action" data-action="show-more-library">Show 25 more</button>`
          : ""
      }
    </section>
  `;
}
