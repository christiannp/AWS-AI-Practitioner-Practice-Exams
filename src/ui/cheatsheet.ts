import { conceptMastery } from "../domain/mastery";
import { escapeHtml } from "./format";
import type { AppContext } from "./types";

export function renderCheatSheet(
  container: HTMLElement,
  context: AppContext
): void {
  const state = context.getState();
  const entries = context.content.cheatSheet
    .filter(
      (entry) =>
        !context.cheatDomain || String(entry.domain) === context.cheatDomain
    )
    .map((entry) => ({
      entry,
      mastery: Math.min(
        ...entry.concepts.map((concept) => conceptMastery(state, concept))
      )
    }))
    .sort(
      (left, right) =>
        left.mastery - right.mastery ||
        left.entry.domain - right.entry.domain
    );

  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro">
      <p class="eyebrow">Memory deck</p>
      <h1 id="page-title">Small hooks, fast recall.</h1>
      <p>Weak concepts appear first. Use these cues between practice groups, not as a substitute for explanations.</p>
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
          ({ entry, mastery }) => `
            <article class="cheat-card">
              <div class="cheat-card-heading">
                <span>D${entry.domain}</span>
                <em>${Math.round(mastery * 100)}% mastery</em>
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
  const entries = context.content.cheatSheet.filter(
    (entry) =>
      !context.cheatDomain || String(entry.domain) === context.cheatDomain
  );
  return [
    "AWS CERTIFIED AI PRACTITIONER — COMMUTER CHEAT SHEET",
    `Generated ${context.today}`,
    "",
    ...entries.flatMap((entry) => [
      `DOMAIN ${entry.domain} — ${entry.title.toUpperCase()}`,
      `HOOK: ${entry.memoryHook}`,
      ...entry.facts.map((fact) => `- ${fact}`),
      ...entry.confusions.map((item) => `WATCH: ${item}`),
      `SOURCE: ${entry.sourceUrl}`,
      ""
    ])
  ].join("\n");
}
