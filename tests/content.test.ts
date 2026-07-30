import { describe, expect, it } from "vitest";
import audit from "../public/data/source-audit.json";
import cheatSheet from "../public/data/cheat-sheet.json";
import materials from "../public/data/source-materials.json";
import exams from "../public/data/practice-exams.json";
import reviews from "../public/data/question-reviews.json";
import questions from "../public/data/questions.json";
import videos from "../public/data/source-videos.json";
import {
  fingerprintQuestion,
  isOfficialAwsDocumentationUrl,
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

describe("official AWS answer authority", () => {
  it("accepts only the documented official AWS verification hosts", () => {
    expect(
      isOfficialAwsDocumentationUrl(
        "https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain1.html"
      )
    ).toBe(true);
    expect(
      isOfficialAwsDocumentationUrl(
        "https://aws.amazon.com/compliance/shared-responsibility-model/"
      )
    ).toBe(true);
    expect(isOfficialAwsDocumentationUrl("https://kiro.dev/docs/")).toBe(true);
    expect(
      isOfficialAwsDocumentationUrl("https://strandsagents.com/latest/")
    ).toBe(true);
    expect(
      isOfficialAwsDocumentationUrl("https://docs.aws.amazon.com.attacker.test/")
    ).toBe(false);
    expect(
      isOfficialAwsDocumentationUrl("https://unapproved.aws.amazon.com/")
    ).toBe(false);
    expect(isOfficialAwsDocumentationUrl("https://example.com/aws-docs")).toBe(
      false
    );
    expect(
      isOfficialAwsDocumentationUrl(
        "http://docs.aws.amazon.com/aws-certification/"
      )
    ).toBe(false);
    expect(
      isOfficialAwsDocumentationUrl("https://docs.aws.amazon.com:8443/")
    ).toBe(false);
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

  it("uses official authority URLs for chapters and rejected claims", () => {
    const course = materials.find(
      (item) => item.id === "youtube:WZeZZ8_W-M4"
    );

    expect(
      course?.chapters.every((chapter) =>
        chapter.verification.every(isOfficialAwsDocumentationUrl)
      )
    ).toBe(true);
    expect(
      course?.rejectedClaims.every((claim) =>
        claim.verification.every(isOfficialAwsDocumentationUrl)
      )
    ).toBe(true);
    expect(isOfficialAwsDocumentationUrl(course?.sourceUrl ?? "")).toBe(false);
    expect(course?.answerAuthority).toBe(false);
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
  it("ships five stable Verified-only 65-question exams", () => {
    expect(exams.map((exam) => exam.id)).toEqual([1, 2, 3, 4, 5]);
    expect(
      exams.every(
        (exam) =>
          exam.questionIds.length === 65 &&
          new Set(exam.questionIds).size === 65
      )
    ).toBe(true);

    const statusByQuestion = new Map(
      reviews.map((review) => [review.questionId, review.status])
    );
    expect(
      exams
        .flatMap((exam) => exam.questionIds)
        .every((id) => statusByQuestion.get(id) === "verified")
    ).toBe(true);
  });

  it("keeps the corrected SSE-S3 source conflict out of every exam", () => {
    expect(
      reviews.filter((review) => review.status === "verified")
    ).toHaveLength(267);
    expect(
      reviews.filter((review) => review.status === "unverified")
    ).toHaveLength(0);
    expect(
      reviews.filter((review) => review.status === "conflicted")
    ).toEqual([
      expect.objectContaining({
        questionId: "aif-d5-sse-s3-object-access-scenario"
      })
    ]);
    expect(exams.flatMap((exam) => exam.questionIds)).not.toContain(
      "aif-d5-sse-s3-object-access-scenario"
    );
  });

  it("keeps both difficulty levels in every practice exam", () => {
    const questionById = new Map(
      questions.map((question) => [question.id, question])
    );

    expect(
      exams.every(
        (exam) =>
          new Set(
            exam.questionIds.map(
              (id) => questionById.get(id)?.difficulty
            )
          ).size === 2
      )
    ).toBe(true);
  });

  it("locks the 260-distinct plus 7-new-and-58-repeat exam policy", () => {
    const firstFourIds = exams
      .slice(0, 4)
      .flatMap((exam) => exam.questionIds);
    const firstFourSet = new Set(firstFourIds);
    const examFive = exams[4]!.questionIds;

    expect(firstFourIds).toHaveLength(260);
    expect(firstFourSet.size).toBe(260);
    expect(examFive.filter((id) => !firstFourSet.has(id))).toHaveLength(7);
    expect(examFive.filter((id) => firstFourSet.has(id))).toHaveLength(58);
  });

  it("has unique IDs, normalized prompts, and semantic fingerprints", () => {
    const ids = questions.map((question) => question.id);
    const prompts = questions.map((question) =>
      normalizeText(question.prompt)
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(prompts).size).toBe(prompts.length);
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
              isOfficialAwsDocumentationUrl(source.url) &&
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
          isOfficialAwsDocumentationUrl(entry.sourceUrl)
      )
    ).toBe(true);
  });

  it("contains no known generated sentence-fragment defects", () => {
    const generatedText = questions.flatMap((question) => [
      question.explanation,
      ...("options" in question
        ? question.options.flatMap((option) => option.distractorReason ?? [])
        : [])
    ]);

    expect(generatedText).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\bbecause it (?:a|an)\b/i),
        expect.stringMatching(/\baWS\b/)
      ])
    );
  });
});

describe("final course-only handoff", () => {
  it("locks the generated inventory, provenance exclusion, and fingerprints", () => {
    expect(questions).toHaveLength(268);
    expect(audit).toHaveLength(680);
    expect(cheatSheet).toHaveLength(20);
    expect(materials).toHaveLength(1);
    expect(
      JSON.stringify({ questions, audit, cheatSheet, materials })
    ).not.toMatch(/examtopics/i);
    expect(new Set(questions.map((question) => question.fingerprint)).size).toBe(
      questions.length
    );
  });
});
