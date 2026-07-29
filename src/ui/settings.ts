import { escapeHtml } from "./format";
import type { AppContext } from "./types";

export function renderSettings(
  container: HTMLElement,
  context: AppContext,
  confirmReset: boolean,
  importError = ""
): void {
  const state = context.getState();
  container.setAttribute("aria-labelledby", "page-title");
  container.innerHTML = `
    <section class="page-intro">
      <p class="eyebrow">Device-local settings</p>
      <h1 id="page-title">Your route, on this device.</h1>
      <p>No account or backend is used. Export a JSON backup before clearing browser data or changing devices.</p>
    </section>

    <section class="settings-stack">
      <article class="settings-card">
        <div>
          <p class="eyebrow">Exam target</p>
          <h2>Target date</h2>
          <p>August 31 is the current placeholder and remains editable.</p>
        </div>
        <label>
          Exam date
          <input type="date" value="${escapeHtml(
            state.settings.targetDate
          )}" data-target-date />
        </label>
      </article>

      <article class="settings-card">
        <div>
          <p class="eyebrow">Backup</p>
          <h2>Progress JSON</h2>
          <p>Includes attempts, every logged error, mastery, sessions, settings, and in-progress answers.</p>
        </div>
        <div class="settings-actions">
          <button type="button" class="secondary-action" data-action="export-progress">Export progress</button>
          <label class="file-action">
            Import progress
            <input type="file" accept="application/json,.json" data-import-progress />
          </label>
        </div>
        ${
          importError
            ? `<p class="form-error" role="alert">${escapeHtml(importError)}</p>`
            : ""
        }
      </article>

      ${
        context.recoveryPayload
          ? `<article class="settings-card warning-card">
              <div>
                <p class="eyebrow">Recovery</p>
                <h2>Unrecognized local data</h2>
                <p>The app started safely without overwriting the original payload.</p>
              </div>
              <button type="button" class="secondary-action" data-action="download-recovery">Download recovery payload</button>
            </article>`
          : ""
      }

      <article class="settings-card danger-card">
        <div>
          <p class="eyebrow">Reset</p>
          <h2>Clear this device</h2>
          <p>Removes only AIF Field Guide data from this browser.</p>
        </div>
        <button type="button" class="danger-action" data-action="request-reset">Reset progress</button>
        ${
          confirmReset
            ? `<div class="reset-confirmation" role="alert">
                <strong>Delete all local study progress?</strong>
                <p>This cannot be undone unless you exported a backup.</p>
                <div>
                  <button type="button" class="danger-action" data-action="confirm-reset">Yes, reset</button>
                  <button type="button" class="secondary-action" data-action="cancel-reset">Cancel</button>
                </div>
              </div>`
            : ""
        }
      </article>
    </section>
  `;
}
