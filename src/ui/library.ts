import { escapeHtml } from "./format";
import type { AppContext } from "./types";

export function renderLibrary(
  container: HTMLElement,
  context: AppContext
): void {
  const state = context.getState();
  const filters = context.libraryFilters;
  const questions = context.content.questions.filter((question) => {
    if (filters.domain && String(question.domain) !== filters.domain) return false;
    if (filters.type && question.type !== filters.type) return false;
    if (
      filters.source &&
      !question.sources.some((source) => source.videoId === filters.source)
    ) {
      return false;
    }
    const attempts = state.attempts[question.id] ?? [];
    if (filters.attempt === "unseen" && attempts.length > 0) return false;
    if (filters.attempt === "attempted" && attempts.length === 0) return false;
    if (
      filters.attempt === "errors" &&
      !attempts.some((attempt) => !attempt.correct)
    ) {
      return false;
    }
    return true;
  });
  const sourceVideos = context.content.videos.filter(
    (video) => video.kind === "questions"
  );

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro">
      <p class="eyebrow">Practice library</p>
      <h1 id="page-title">Choose your route.</h1>
      <p>Start an untimed 65-question mixed mock, revisit one source video, or inspect the verified bank.</p>
    </section>

    <section class="library-actions">
      <article>
        <span class="action-number">65</span>
        <div>
          <h2>Mixed mock</h2>
          <p>Unique questions, current exam coverage, no timer.</p>
        </div>
        <button type="button" class="primary-small" data-action="start-mock">Start mock</button>
      </article>
      <article>
        <span class="action-number">▶</span>
        <div>
          <h2>Source group</h2>
          <p>Use the video filter below, then start its consolidated concepts.</p>
        </div>
        <button type="button" class="secondary-action" data-action="start-source" ${
          filters.source ? "" : "disabled"
        }>Start source</button>
      </article>
    </section>

    <section class="filter-panel" aria-labelledby="filter-title">
      <div class="section-heading">
        <h2 id="filter-title">Filter ${context.content.questions.length} questions</h2>
        <span>${questions.length} match</span>
      </div>
      <div class="filter-grid">
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
        <label>History
          <select data-library-filter="attempt">
            ${[
              ["", "Any history"],
              ["unseen", "Unseen"],
              ["attempted", "Attempted"],
              ["errors", "Errors logged"]
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${
                    filters.attempt === value ? "selected" : ""
                  }>${label}</option>`
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
      </div>
    </section>

    <section class="bank-preview" aria-labelledby="bank-title">
      <div class="section-heading">
        <h2 id="bank-title">Verified bank preview</h2>
        <span>Showing ${Math.min(30, questions.length)}</span>
      </div>
      <div class="question-index">
        ${questions
          .slice(0, 30)
          .map((question) => {
            const attempts = state.attempts[question.id] ?? [];
            const errors = attempts.filter((attempt) => !attempt.correct).length;
            return `<article>
              <div>
                <span>D${question.domain} · ${escapeHtml(
                  question.type.replace("-", " ")
                )}</span>
                <strong>${escapeHtml(question.prompt)}</strong>
              </div>
              <em>${
                attempts.length === 0
                  ? "Unseen"
                  : `${attempts.length} tried · ${errors} errors`
              }</em>
            </article>`;
          })
          .join("")}
      </div>
    </section>
  `;
}
