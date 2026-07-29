// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { bootApp } from "../src/main";

describe("app shell", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("gives the study app a named main region and primary daily action", () => {
    const root = document.querySelector<HTMLElement>("#app")!;

    bootApp(root);

    expect(root.querySelector("main")?.getAttribute("aria-labelledby")).toBe(
      "page-title"
    );
    expect(root.querySelector("h1")?.textContent).toContain(
      "AWS AI Practitioner"
    );
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="start-daily"]')
        ?.textContent
    ).toContain("25 questions");
  });
});
