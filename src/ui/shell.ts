import type { LearnerState } from "../data/types";
import { formatDate } from "./format";
import type { Route } from "./types";

export interface AppShell {
  main: HTMLElement;
  announce(message: string): void;
  setRoute(route: Route): void;
  updateTarget(state: LearnerState): void;
}

const navItems: Array<{ route: Route; label: string }> = [
  { route: "home", label: "Today" },
  { route: "library", label: "Library" },
  { route: "cheatsheet", label: "Cheat sheet" },
  { route: "settings", label: "Settings" }
];

export function renderShell(
  root: HTMLElement,
  state: LearnerState
): AppShell {
  root.innerHTML = `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="#/home" aria-label="AIF Field Guide home">
          <span class="brand-mark" aria-hidden="true">AIF</span>
          <span>
            <strong>AIF Field Guide</strong>
            <small>Certified AI Practitioner</small>
          </span>
        </a>
        <span class="target-chip" data-target-chip>Target · ${formatDate(
          state.settings.targetDate
        )}</span>
      </header>
      <div class="status-region" aria-live="polite" aria-atomic="true"></div>
      <main id="main-content" tabindex="-1"></main>
      <nav class="bottom-nav" aria-label="Primary">
        ${navItems
          .map(
            (item) =>
              `<a href="#/${item.route}" data-route="${item.route}">${item.label}</a>`
          )
          .join("")}
      </nav>
    </div>
  `;

  const main = root.querySelector<HTMLElement>("#main-content")!;
  const status = root.querySelector<HTMLElement>(".status-region")!;
  return {
    main,
    announce(message) {
      status.textContent = "";
      requestAnimationFrame(() => {
        status.textContent = message;
      });
    },
    setRoute(route) {
      for (const link of root.querySelectorAll<HTMLElement>("[data-route]")) {
        link.classList.toggle("is-active", link.dataset.route === route);
      }
    },
    updateTarget(nextState) {
      const chip = root.querySelector<HTMLElement>("[data-target-chip]");
      if (chip) {
        chip.textContent = `Target · ${formatDate(
          nextState.settings.targetDate
        )}`;
      }
    }
  };
}
