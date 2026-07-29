import { describe, expect, it } from "vitest";
import audit from "../public/data/source-audit.json";
import cheatSheet from "../public/data/cheat-sheet.json";
import materials from "../public/data/source-materials.json";
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
          ["included", "merged", "corrected", "excluded"].includes(
            entry.status
          ) &&
          entry.reason.length > 0 &&
          entry.videoId.length > 0 &&
          entry.timestampSeconds >= 0 &&
          entry.promptSummary.length <= 180
      )
    ).toBe(true);
  });

  it("maps every retained source item to a shipped question", () => {
    const questionById = new Map(
      questions.map((question) => [question.id, question])
    );

    expect(
      audit
        .filter((entry) => entry.status !== "excluded")
        .every((entry) => {
          const question = questionById.get(entry.questionId);
          return question?.sources.some(
            (source) =>
              source.videoId === entry.videoId &&
              "questionNumber" in source &&
              source.questionNumber === entry.questionNumber
          );
        })
    ).toBe(true);
  });
});

describe("course syllabus audit", () => {
  it("preserves canonical metadata and all 16 chapter classifications", () => {
    const course = materials.find(
      (item) => item.id === "youtube:WZeZZ8_W-M4"
    );
    expect(course).toMatchObject({
      title:
        "AWS Certified AI Practitioner (AIF-C01) – Full Course to PASS the Certification Exam",
      author: "freeCodeCamp.org",
      kind: "course",
      sourceUrl: "https://www.youtube.com/watch?v=WZeZZ8_W-M4",
      role: "informational-syllabus-only",
      answerAuthority: false,
      durationSeconds: 53928
    });
    expect(
      course?.chapters.map(({ title, startSeconds, coverage }) => [
        title,
        startSeconds,
        coverage
      ])
    ).toEqual([
      ["Introduction", 0, "outdated"],
      ["AI and ML Fundamentals", 1068, "covered"],
      ["Data", 4607, "covered"],
      ["Gen AI Primer", 5508, "covered"],
      ["Amazon Bedrock", 7342, "covered"],
      ["Datastores for GenAI", 26160, "covered"],
      ["PartyRock", 28338, "out-of-scope"],
      ["Amazon SageMaker AI", 29326, "covered"],
      ["Evaluations", 34904, "covered"],
      ["AI Developer Tools", 36398, "covered"],
      ["AWS Managed ML", 37814, "covered"],
      ["Generative AI Security", 47970, "covered"],
      ["Amazon Athena", 48918, "out-of-scope"],
      ["AWS Glue", 49875, "covered"],
      ["Amazon OpenSearch Service", 52386, "covered"],
      ["AWS Lake Formation", 53772, "gap"]
    ]);
    expect(
      course?.chapters.every(
        (chapter) =>
          Array.isArray(chapter.domains) &&
          Array.isArray(chapter.tasks) &&
          Array.isArray(chapter.concepts)
      )
    ).toBe(true);
  });

  it("rejects beta-era duration and case-study claims", () => {
    const course = materials.find(
      (item) => item.id === "youtube:WZeZZ8_W-M4"
    );
    expect(course?.rejectedClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: "The exam duration is 120 minutes.",
          currentRule: "The current exam duration is 90 minutes."
        }),
        expect.objectContaining({
          claim: "Case studies are an exam interaction format.",
          currentRule:
            "The current guide lists multiple choice, multiple response, ordering, and matching."
        })
      ])
    );
  });

  it("teaches the Lake Formation gap only as an official addition", () => {
    const lakeFormationQuestionIds = [
      "aif-d5-aws-lake-formation-scenario",
      "aif-d5-aws-lake-formation-definition"
    ];
    const lakeFormationQuestions = questions.filter((question) =>
      lakeFormationQuestionIds.includes(question.id)
    );

    expect(lakeFormationQuestions).toHaveLength(2);
    expect(
      lakeFormationQuestions.every(
        (question) =>
          question.origin === "official-addition" &&
          question.sources.length === 0 &&
          question.concepts.length === 1 &&
          question.concepts[0] === "aws-lake-formation"
      )
    ).toBe(true);
    expect(
      lakeFormationQuestions.every(
        (question) =>
          question.verification.length === 1 &&
          question.verification.every(
            (verification) =>
              verification.title ===
                "AWS documentation: AWS Lake Formation" &&
              verification.url ===
                "https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html" &&
              verification.verifiedOn === "2026-07-29"
          )
      )
    ).toBe(true);
    expect(
      cheatSheet.some((entry) =>
        entry.concepts.includes("aws-lake-formation")
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
    expect(questions.length).toBeGreaterThanOrEqual(200);
    expect(
      questions.every(
        (question) =>
          question.explanation.length > 0 &&
          question.concepts.length > 0 &&
          ["source-derived", "official-addition"].includes(question.origin) &&
          (question.origin === "official-addition" ||
            question.sources.length > 0) &&
          question.verification.length > 0 &&
          question.verification.every(
            (source) =>
              source.url.startsWith("https://") &&
              source.verifiedOn >= "2026-07-29"
          )
      )
    ).toBe(true);
  });

  it("covers every task in the current AIF-C01 exam guide", () => {
    expect(new Set(questions.map((question) => question.task))).toEqual(
      new Set([
        "1.1",
        "1.2",
        "1.3",
        "2.1",
        "2.2",
        "2.3",
        "3.1",
        "3.2",
        "3.3",
        "3.4",
        "4.1",
        "4.2",
        "5.1",
        "5.2"
      ])
    );
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
