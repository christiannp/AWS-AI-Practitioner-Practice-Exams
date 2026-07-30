import type { Route } from "./types";

export interface AppShell {
  main: HTMLElement;
  announce(message: string): void;
  setRoute(route: Route): void;
}

const navItems: Array<{ route: Route; label: string; icon: string }> = [
  { route: "exams", label: "Practice Exams", icon: "01" },
  { route: "cheatsheet", label: "Cheat Sheet", icon: "⌁" },
  { route: "library", label: "Library", icon: "≡" }
];

export function renderShell(root: HTMLElement): AppShell {
  root.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="#/exams" aria-label="AIF Field Guide practice exams">
          <span class="brand-mark" aria-hidden="true">AIF</span>
          <span>
            <strong>AIF Field Guide</strong>
            <small>AWS Certified AI Practitioner</small>
          </span>
        </a>
        <span class="local-chip">Saved on this device</span>
      </header>
      <div class="status-region" aria-live="polite" aria-atomic="true"></div>
      <main id="main-content" tabindex="-1"></main>
      <nav class="bottom-nav" aria-label="Primary">
        ${navItems
          .map(
            (item) => `
              <a href="#/${item.route}" data-route="${item.route}">
                <span aria-hidden="true">${item.icon}</span>
                <strong>${item.label}</strong>
              </a>
            `
          )
          .join("")}
      </nav>
    </div>
  `;

  const main = root.querySelector<HTMLElement>("#main-content")!;
  const status = root.querySelector<HTMLElement>(".status-region")!;
  let announcementTimer: number | undefined;
  return {
    main,
    announce(message) {
      if (announcementTimer !== undefined) {
        window.clearTimeout(announcementTimer);
      }
      status.textContent = message;
      announcementTimer = window.setTimeout(() => {
        status.textContent = "";
        announcementTimer = undefined;
      }, 4_000);
    },
    setRoute(route) {
      const activeRoute =
        route === "practice" || route === "results" ? "exams" : route;
      for (const link of root.querySelectorAll<HTMLElement>("[data-route]")) {
        link.classList.toggle(
          "is-active",
          link.dataset.route === activeRoute
        );
      }
    }
  };
}
