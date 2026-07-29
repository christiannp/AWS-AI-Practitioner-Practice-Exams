import { describe, expect, it } from "vitest";
import {
  isMappedDisposition,
  sourceFilterKey
} from "../scripts/source-audit.mjs";

describe("mixed source audit contracts", () => {
  it("requires mapped dispositions to point to a bank question", () => {
    expect(isMappedDisposition("represented")).toBe(true);
    expect(isMappedDisposition("new-rewrite")).toBe(true);
    expect(isMappedDisposition("semantic-duplicate")).toBe(true);
    expect(isMappedDisposition("incorrect-source-answer")).toBe(true);
    expect(isMappedDisposition("outdated")).toBe(false);
    expect(isMappedDisposition("ambiguous")).toBe(false);
    expect(isMappedDisposition("out-of-scope")).toBe(false);
  });

  it("builds stable filter values for both provenance types", () => {
    expect(
      sourceFilterKey({
        sourceType: "youtube",
        playlistId: "p",
        videoId: "video-1",
        videoTitle: "Video",
        url: "https://www.youtube.com/watch?v=video-1"
      })
    ).toBe("youtube:video-1");
    expect(
      sourceFilterKey({
        sourceType: "examtopics",
        sourceKey: "examtopics:aif-c01:7",
        sourceLabel: "ExamTopics AIF-C01",
        url: "https://www.examtopics.com/example",
        pageNumber: 1,
        questionNumber: 7
      })
    ).toBe("examtopics:aif-c01");
  });
});
