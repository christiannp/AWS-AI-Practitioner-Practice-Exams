import { escapeHtml } from "./format";
import type { AppContext } from "./types";

export function renderExams(
  container: HTMLElement,
  context: AppContext
): void {
  const state = context.getState();
  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro exam-intro">
      <p class="eyebrow">Practice Exams</p>
      <h1 id="page-title">Learn the exam by doing.</h1>
      <p>Five untimed sets. Answers stay hidden until you submit, then missed questions become your next practice round.</p>
    </section>

    <section class="exam-grid" aria-label="Practice exam collection">
      ${context.content.exams
        .map((exam) => {
          const result = state.examResults[String(exam.id)];
          const isActive = state.inProgress?.examId === exam.id;
          const action = isActive ? "resume-exam" : "start-exam";
          const actionLabel = isActive
            ? "Resume"
            : result
              ? "Practice again"
              : "Start exam";
          return `
            <article class="exam-card" data-exam-card="${exam.id}">
              <div class="exam-number" aria-hidden="true">${String(
                exam.id
              ).padStart(2, "0")}</div>
              <div class="exam-card-copy">
                <p class="eyebrow">Set ${exam.id}</p>
                <h2>${escapeHtml(exam.title)}</h2>
                <p>65 questions · 7 pages · untimed</p>
                <div class="exam-status">
                  ${
                    result
                      ? `<strong>${result.score}% last score</strong>
                         <span>${result.mastered ? "Mastered" : `${result.masteryQueue.length} to review`}</span>`
                      : "<strong>Not started</strong><span>Verified questions only</span>"
                  }
                </div>
              </div>
              <button
                type="button"
                class="${isActive ? "primary-small" : "secondary-action"}"
                data-action="${action}"
                data-exam-id="${exam.id}"
              >${actionLabel}</button>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}
