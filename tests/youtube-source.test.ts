import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { captionsFromXml } from "../scripts/youtube-source.mjs";

const captionFixture = readFileSync(
  fileURLToPath(new URL("./fixtures/captions.xml", import.meta.url)),
  "utf8"
);

describe("YouTube caption parsing", () => {
  it("recovers timed text format 3 word segments", () => {
    expect(captionsFromXml(captionFixture)).toEqual([
      {
        startSeconds: 1.439,
        durationSeconds: 4.001,
        text: "A company uses Bedrock."
      },
      {
        startSeconds: 6,
        durationSeconds: 1.5,
        text: "Correct answer."
      }
    ]);
  });
});
