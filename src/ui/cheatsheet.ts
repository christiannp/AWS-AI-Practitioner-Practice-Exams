import type { CheatSheetEntry } from "../data/types";
import { escapeHtml } from "./format";
import type { AppContext } from "./types";

interface OrderedEntry {
  entry: CheatSheetEntry;
  baselineIndex: number;
  wrongCount: number;
}

export function orderedCheatSheetEntries(
  context: AppContext
): OrderedEntry[] {
  const wrongCountByConcept = new Map<string, number>();
  for (const attempts of Object.values(context.getState().attempts)) {
    for (const attempt of attempts) {
      if (attempt.correct) continue;
      const question = context.questionById(attempt.questionId);
      for (const concept of question?.concepts ?? []) {
        wrongCountByConcept.set(
          concept,
          (wrongCountByConcept.get(concept) ?? 0) + 1
        );
      }
    }
  }

  return context.content.cheatSheet
    .map((entry, baselineIndex) => ({
      entry,
      baselineIndex,
      wrongCount: entry.concepts.reduce(
        (total, concept) => total + (wrongCountByConcept.get(concept) ?? 0),
        0
      )
    }))
    .filter(
      ({ entry }) =>
        !context.cheatDomain || String(entry.domain) === context.cheatDomain
    )
    .sort(
      (left, right) =>
        right.wrongCount - left.wrongCount ||
        left.baselineIndex - right.baselineIndex
    );
}

export function renderCheatSheet(
  container: HTMLElement,
  context: AppContext
): void {
  const entries = orderedCheatSheetEntries(context);

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro">
      <p class="eyebrow">Cheat Sheet</p>
      <h1 id="page-title">High leverage first.</h1>
      <p>The initial sequence follows <em>The First 20 Hours</em>: learn the distinctions that unlock the most questions. Local mistakes quietly move related cards forward.</p>
    </section>

    <section class="cheat-toolbar">
      <label>Domain
        <select data-cheat-domain>
          <option value="">All domains</option>
          ${[1, 2, 3, 4, 5]
            .map(
              (domain) =>
                `<option value="${domain}" ${
                  context.cheatDomain === String(domain) ? "selected" : ""
                }>Domain ${domain}</option>`
            )
            .join("")}
        </select>
      </label>
      <button type="button" class="secondary-action" data-action="download-cheatsheet">Download text</button>
      <button type="button" class="secondary-action" data-action="print-cheatsheet">Print</button>
    </section>

    <section class="cheat-grid" aria-label="Cheat-sheet memory notes">
      ${entries
        .map(
          ({ entry, baselineIndex, wrongCount }) => `
            <article class="cheat-card" data-cheat-id="${escapeHtml(entry.id)}">
              <div class="cheat-card-heading">
                <span>D${entry.domain}</span>
                <em>${
                  wrongCount > 0
                    ? `Review priority · ${wrongCount} ${wrongCount === 1 ? "miss" : "misses"}`
                    : `First 20 Hours · Step ${baselineIndex + 1}`
                }</em>
              </div>
              <h2>${escapeHtml(entry.title)}</h2>
              <blockquote>${escapeHtml(entry.memoryHook)}</blockquote>
              <ul>
                ${entry.facts
                  .map((fact) => `<li>${escapeHtml(fact)}</li>`)
                  .join("")}
              </ul>
              ${
                entry.confusions.length > 0
                  ? `<div class="confusion-note"><strong>Do not confuse</strong>${entry.confusions
                      .map((item) => `<p>${escapeHtml(item)}</p>`)
                      .join("")}</div>`
                  : ""
              }
              <a href="${escapeHtml(
                entry.sourceUrl
              )}" target="_blank" rel="noreferrer">Open AWS source ↗</a>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

export function cheatSheetText(context: AppContext): string {
  const entries = orderedCheatSheetEntries(context);
  return [
    "AWS CERTIFIED AI PRACTITIONER — COMMUTER CHEAT SHEET",
    `Generated ${context.today}`,
    "Order: First 20 Hours baseline with local wrong-answer promotion",
    "",
    ...entries.flatMap(({ entry, wrongCount }) => [
      `DOMAIN ${entry.domain} — ${entry.title.toUpperCase()}`,
      ...(wrongCount > 0 ? [`REVIEW PRIORITY: ${wrongCount}`] : []),
      `HOOK: ${entry.memoryHook}`,
      ...entry.facts.map((fact) => `- ${fact}`),
      ...entry.confusions.map((item) => `WATCH: ${item}`),
      `SOURCE: ${entry.sourceUrl}`,
      ""
    ])
  ].join("\n");
}
