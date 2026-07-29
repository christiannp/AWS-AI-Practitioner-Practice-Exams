import { describe, expect, it } from "vitest";
import audit from "../public/data/source-audit.json";
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
