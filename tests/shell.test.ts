// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderShell } from "../src/ui/shell";

afterEach(() => {
  vi.useRealTimers();
});

describe("application announcements", () => {
  it("dismisses a status message after four seconds", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>("#app")!;
    const shell = renderShell(root);

    shell.announce("Practice Exam 1 submitted.");
    expect(root.querySelector(".status-region")?.textContent).toBe(
      "Practice Exam 1 submitted."
    );

    vi.advanceTimersByTime(4_001);
    expect(root.querySelector(".status-region")?.textContent).toBe("");
  });
});
