import { describe, expect, it } from "vitest";
import audit from "../public/data/source-audit.json";
import cheatSheet from "../public/data/cheat-sheet.json";
import questions from "../public/data/questions.json";
import videos from "../public/data/source-videos.json";
import {
  fingerprintQuestion,
  normalizeText
} from "../scripts/normalize-question.mjs";

describe("question normalization", () => {
  it("treats punctuation, case, and an AWS service alias as the same prompt", () => {
    const first = "Amazon SageMaker AI — which service?";
    const second = "amazon sagemaker, which service";

    expect(normalizeText(first)).toBe(normalizeText(second));
  });

  it("gives semantically identical tagged prompts the same fingerprint", () => {
    const first = fingerprintQuestion("What does Amazon Bedrock do?", [
      "foundation-models",
      "bedrock"
    ]);
    const second = fingerprintQuestion("what does amazon bedrock do", [
      "bedrock",
      "foundation-models"
    ]);

    expect(first).toBe(second);
  });
});

describe("source audit", () => {
  it("catalogs both supplied playlists", () => {
    expect(new Set(videos.map((video) => video.playlistId))).toEqual(
      new Set([
        "PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf",
        "PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_"
      ])
    );
  });

  it("gives every recovered source question a traceable disposition", () => {
    expect(audit).toHaveLength(680);
    expect(
      audit.every(
        (entry) =>
          ["pending", "included", "merged", "corrected", "excluded"].includes(
            entry.status
          ) &&
          entry.reason.length > 0 &&
          entry.videoId.length > 0 &&
          entry.timestampSeconds >= 0
      )
    ).toBe(true);
  });
});

describe("verified content bank", () => {
  it("has unique IDs, normalized prompts, and semantic fingerprints", () => {
    const ids = questions.map((question) => question.id);
    const prompts = questions.map((question) =>
      normalizeText(question.prompt)
    );
    const fingerprints = questions.map((question) => question.fingerprint);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it("ships only explained questions with dated HTTPS verification", () => {
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(
      questions.every(
        (question) =>
          question.explanation.length > 0 &&
          question.concepts.length > 0 &&
          question.sources.length > 0 &&
          question.verification.length > 0 &&
          question.verification.every(
            (source) =>
              source.url.startsWith("https://") &&
              source.verifiedOn >= "2026-07-29"
          )
      )
    ).toBe(true);
  });

  it("includes all four current AIF-C01 interaction formats", () => {
    expect(new Set(questions.map((question) => question.type))).toEqual(
      new Set([
        "multiple-choice",
        "multiple-response",
        "ordering",
        "matching"
      ])
    );
  });

  it("gives every domain at least one cheat-sheet memory hook", () => {
    expect(new Set(cheatSheet.map((entry) => entry.domain))).toEqual(
      new Set([1, 2, 3, 4, 5])
    );
    expect(
      cheatSheet.every(
        (entry) =>
          entry.memoryHook.length > 0 &&
          entry.facts.length > 0 &&
          entry.sourceUrl.startsWith("https://")
      )
    ).toBe(true);
  });
});
