import { conceptMastery } from "../domain/mastery";
import { daysBetween, escapeHtml, formatDate } from "./format";
import type { AppContext } from "./types";

const domainNames = [
  "AI & ML fundamentals",
  "Generative AI",
  "Foundation models",
  "Responsible AI",
  "Security & governance"
];
const domainWeights = [20, 24, 28, 14, 14];

function domainMastery(context: AppContext, domain: number): number {
  const concepts = new Set(
    context.content.questions
      .filter((question) => question.domain === domain)
      .flatMap((question) => question.concepts)
  );
  if (concepts.size === 0) return 0.35;
  return (
    [...concepts].reduce(
      (total, concept) => total + conceptMastery(context.getState(), concept),
      0
    ) / concepts.size
  );
}

export function renderHome(
  container: HTMLElement,
  context: AppContext
): void {
  const state = context.getState();
  const completedHours = Math.min(20, state.sessions.length);
  const remaining = daysBetween(
    context.today,
    state.settings.targetDate
  );
  const errorCount = Object.values(state.attempts)
    .flat()
    .filter((attempt) => !attempt.correct).length;
  const studyStops = Array.from({ length: 20 }, (_, index) => {
    const className =
      index < completedHours
        ? "route-stop is-complete"
        : index === completedHours
          ? "route-stop is-current"
          : "route-stop";
    return `<span class="${className}" aria-hidden="true"></span>`;
  }).join("");

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="route-card" aria-labelledby="route-title">
      <div class="section-label">
        <span>First 20 Hours route</span>
        <strong>${completedHours} / 20 sessions</strong>
      </div>
      <div class="route-line" aria-hidden="true">${studyStops}</div>
      <p id="route-title">${
        completedHours === 0
          ? "First stop: a balanced diagnostic across all five domains."
          : `Stop ${Math.min(completedHours + 1, 20)} prioritizes weak, unseen, and due concepts.`
      }</p>
    </section>

    <section class="daily-ticket">
      <div>
        <p class="eyebrow">Today's commute</p>
        <h1 id="page-title">AWS AI Practitioner</h1>
        <p class="lead">
          One focused group. Submit once, then review every explanation.
        </p>
      </div>
      ${
        state.inProgress
          ? `<button class="primary-action" type="button" data-action="resume-session">
              Resume ${state.inProgress.currentIndex + 1} / ${state.inProgress.questionIds.length}
              <span aria-hidden="true">→</span>
            </button>
            <button class="secondary-on-dark" type="button" data-action="start-daily">
              Replace with today's group
            </button>`
          : `<button class="primary-action" type="button" data-action="start-daily">
              Start today's 25 questions
              <span aria-hidden="true">→</span>
            </button>`
      }
      <dl class="ticket-meta">
        <div><dt>Mode</dt><dd>Adaptive</dd></div>
        <div><dt>Answers</dt><dd>After submit</dd></div>
        <div><dt>Timer</dt><dd>None</dd></div>
      </dl>
    </section>

    <section class="domain-board" aria-labelledby="domain-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Exam map</p>
          <h2 id="domain-title">Five domains, one route</h2>
        </div>
        <span>${context.content.questions.length} questions</span>
      </div>
      <ol class="domain-list">
        ${domainNames
          .map((name, index) => {
            const mastery = Math.round(domainMastery(context, index + 1) * 100);
            return `<li>
              <b>0${index + 1}</b>
              <span>
                ${escapeHtml(name)}
                <span class="mastery-track" aria-label="${mastery}% mastery">
                  <span style="width:${mastery}%"></span>
                </span>
              </span>
              <em>${mastery}% · ${domainWeights[index]}%</em>
            </li>`;
          })
          .join("")}
      </ol>
    </section>

    <section class="quick-stats" aria-label="Study status">
      <article>
        <strong>${remaining < 0 ? 0 : remaining}</strong>
        <span>days to ${escapeHtml(formatDate(state.settings.targetDate))}</span>
      </article>
      <article>
        <strong>${state.sessions.length}</strong>
        <span>groups completed</span>
      </article>
      <article>
        <strong>${errorCount}</strong>
        <span>errors logged</span>
      </article>
    </section>
  `;
}
