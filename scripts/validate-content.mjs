import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  fingerprintQuestion,
  isOfficialAwsDocumentationUrl,
  normalizeText
} from "./normalize-question.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowPending = process.argv.includes("--allow-pending");
const errors = [];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function validateOptions(question, correctIds) {
  requireValue(
    Array.isArray(question.options) && question.options.length >= 4,
    `${question.id}: choice questions need at least four options`
  );
  const optionIds = (question.options ?? []).map((option) => option.id);
  requireValue(
    duplicateValues(optionIds).length === 0,
    `${question.id}: duplicate option IDs`
  );
  for (const correctId of correctIds) {
    requireValue(
      optionIds.includes(correctId),
      `${question.id}: correct option ${correctId} is missing`
    );
  }
  for (const option of question.options ?? []) {
    if (!correctIds.includes(option.id)) {
      requireValue(
        typeof option.distractorReason === "string" &&
          option.distractorReason.length > 0,
        `${question.id}: distractor ${option.id} needs a reason`
      );
    }
  }
}

function validateQuestion(question, videoIds) {
  requireValue(typeof question.id === "string", "Question has no stable ID");
  requireValue(
    ["source-derived", "official-addition"].includes(question.origin),
    `${question.id}: invalid content origin`
  );
  requireValue(
    [1, 2, 3, 4, 5].includes(question.domain),
    `${question.id}: invalid domain`
  );
  requireValue(
    typeof question.task === "string" && /^\d\.\d$/.test(question.task),
    `${question.id}: invalid task`
  );
  requireValue(
    typeof question.prompt === "string" && question.prompt.length > 20,
    `${question.id}: prompt is missing or too short`
  );
  requireValue(
    Array.isArray(question.concepts) && question.concepts.length > 0,
    `${question.id}: concepts are required`
  );
  requireValue(
    typeof question.explanation === "string" &&
      question.explanation.length > 20,
    `${question.id}: explanation is required`
  );
  requireValue(
    !/\bbecause it (?:a|an)\b/i.test(question.explanation ?? "") &&
      !/\baWS\b/.test(question.explanation ?? ""),
    `${question.id}: explanation contains a known generated sentence-fragment defect`
  );
  requireValue(
    Array.isArray(question.sources) &&
      (question.origin === "official-addition" || question.sources.length > 0),
    `${question.id}: source-derived questions need source provenance`
  );
  for (const source of question.sources ?? []) {
    requireValue(
      videoIds.has(source.videoId),
      `${question.id}: source video ${source.videoId} is not cataloged`
    );
    requireValue(
      typeof source.url === "string" &&
        source.url.startsWith("https://www.youtube.com/"),
      `${question.id}: source URL must be a YouTube HTTPS URL`
    );
  }
  requireValue(
    Array.isArray(question.verification) && question.verification.length > 0,
    `${question.id}: verification is required`
  );
  for (const verification of question.verification ?? []) {
    requireValue(
      isOfficialAwsDocumentationUrl(verification.url),
      `${question.id}: verification URL must use an approved official AWS documentation host`
    );
    requireValue(
      verification.verifiedOn >= "2026-07-29",
      `${question.id}: verification date is stale or missing`
    );
  }
  for (const option of question.options ?? []) {
    requireValue(
      !/\bbecause it (?:a|an)\b/i.test(option.distractorReason ?? "") &&
        !/\baWS\b/.test(option.distractorReason ?? ""),
      `${question.id}: distractor ${option.id} contains a known generated sentence-fragment defect`
    );
  }

  const expectedFingerprint = fingerprintQuestion(
    question.prompt,
    question.concepts
  );
  requireValue(
    question.fingerprint === expectedFingerprint,
    `${question.id}: fingerprint does not match normalized content`
  );

  switch (question.type) {
    case "multiple-choice":
      validateOptions(question, [question.correctId]);
      break;
    case "multiple-response":
      requireValue(
        Array.isArray(question.correctIds) && question.correctIds.length >= 2,
        `${question.id}: multiple-response needs at least two answers`
      );
      validateOptions(question, question.correctIds ?? []);
      break;
    case "ordering": {
      const itemIds = (question.items ?? []).map((item) => item.id);
      requireValue(
        itemIds.length >= 3 && itemIds.length <= 5,
        `${question.id}: ordering needs three to five items`
      );
      requireValue(
        JSON.stringify([...itemIds].sort()) ===
          JSON.stringify([...(question.correctOrder ?? [])].sort()),
        `${question.id}: ordering answer must contain every item exactly once`
      );
      break;
    }
    case "matching": {
      const promptIds = (question.prompts ?? []).map((prompt) => prompt.id);
      const targetIds = new Set(
        (question.targets ?? []).map((target) => target.id)
      );
      requireValue(
        promptIds.length >= 3 && promptIds.length <= 7,
        `${question.id}: matching needs three to seven prompts`
      );
      requireValue(
        promptIds.every(
          (promptId) =>
            typeof question.correctMatches?.[promptId] === "string" &&
            targetIds.has(question.correctMatches[promptId])
        ),
        `${question.id}: every matching prompt needs a valid target`
      );
      break;
    }
    default:
      errors.push(`${question.id}: unsupported question type ${question.type}`);
  }
}

const [
  questions,
  audit,
  videos,
  cheatSheet,
  materials,
  exams,
  reviews,
  corrections
] =
  await Promise.all([
    readJson("public/data/questions.json"),
    readJson("public/data/source-audit.json"),
    readJson("public/data/source-videos.json"),
    readJson("public/data/cheat-sheet.json"),
    readJson("public/data/source-materials.json"),
    readJson("public/data/practice-exams.json"),
    readJson("public/data/question-reviews.json"),
    readFile(path.join(root, "source-answer-corrections.txt"), "utf8")
  ]);

const finalCourseHandoff = { questions, audit, cheatSheet, materials };
for (const [label, actual, expected] of [
  ["questions", questions.length, 268],
  ["source audit records", audit.length, 680],
  ["memory notes", cheatSheet.length, 20],
  ["source materials", materials.length, 1]
]) {
  requireValue(
    actual === expected,
    `Final course handoff requires ${expected} ${label}; found ${actual}`
  );
}
requireValue(
  new Set(questions.map((question) => question.fingerprint)).size ===
    questions.length,
  "Final course handoff requires unique question fingerprints"
);

const videoIds = new Set(videos.map((video) => video.videoId));
for (const question of questions) validateQuestion(question, videoIds);

const contentQuestionIds = new Set(questions.map((question) => question.id));
const reviewByQuestion = new Map(
  reviews.map((review) => [review.questionId, review])
);
requireValue(exams.length === 5, "Exactly five practice exams are required");
requireValue(
  exams.every((exam, index) => exam.id === index + 1),
  "Practice exam IDs must be sequential from 1 through 5"
);
for (const exam of exams) {
  requireValue(
    exam.title === `Practice Exam ${exam.id}`,
    `Practice Exam ${exam.id}: title must match its numeric ID`
  );
  requireValue(
    exam.version === 1,
    `Practice Exam ${exam.id}: unsupported manifest version`
  );
  requireValue(
    Array.isArray(exam.questionIds) && exam.questionIds.length === 65,
    `Practice Exam ${exam.id}: exactly 65 question IDs are required`
  );
  requireValue(
    duplicateValues(exam.questionIds ?? []).length === 0,
    `Practice Exam ${exam.id}: question IDs must be unique within the exam`
  );
  for (const questionId of exam.questionIds ?? []) {
    requireValue(
      contentQuestionIds.has(questionId),
      `Practice Exam ${exam.id}: unknown question ${questionId}`
    );
    requireValue(
      reviewByQuestion.get(questionId)?.status === "verified",
      `Practice Exam ${exam.id}: ${questionId} is not Verified`
    );
  }
}
const firstFourQuestionIds = exams
  .slice(0, 4)
  .flatMap((exam) => exam.questionIds);
const firstFourQuestionSet = new Set(firstFourQuestionIds);
const examFiveQuestionIds = exams[4]?.questionIds ?? [];
requireValue(
  firstFourQuestionIds.length === 260 && firstFourQuestionSet.size === 260,
  "Practice Exams 1–4 must contain 260 distinct questions"
);
requireValue(
  examFiveQuestionIds.filter((id) => !firstFourQuestionSet.has(id)).length ===
    7 &&
    examFiveQuestionIds.filter((id) => firstFourQuestionSet.has(id)).length ===
      58,
  "Practice Exam 5 must contain 7 new questions and 58 fixed repeats"
);

requireValue(
  reviews.length === questions.length &&
    reviewByQuestion.size === questions.length,
  "Every question must have exactly one review record"
);
for (const review of reviews) {
  requireValue(
    contentQuestionIds.has(review.questionId),
    `Review references unknown question ${review.questionId}`
  );
  requireValue(
    ["verified", "unverified", "conflicted"].includes(review.status),
    `${review.questionId}: invalid review status`
  );
  requireValue(
    typeof review.reason === "string" && review.reason.length > 20,
    `${review.questionId}: review reason is required`
  );
  requireValue(
    Array.isArray(review.proof),
    `${review.questionId}: proof must be an array`
  );
  if (review.status === "verified" || review.status === "conflicted") {
    requireValue(
      review.proof.length > 0 &&
        review.proof.every((item) =>
          isOfficialAwsDocumentationUrl(item.url)
        ),
      `${review.questionId}: ${review.status} review requires official proof`
    );
  }
}
requireValue(
  reviews.filter((review) => review.status === "verified").length === 267 &&
    reviews.filter((review) => review.status === "unverified").length === 0 &&
    reviews.filter((review) => review.status === "conflicted").length === 1,
  "Review handoff requires 267 Verified, 0 Unverified, and 1 Conflicted"
);
requireValue(
  reviewByQuestion.get("aif-d5-sse-s3-object-access-scenario")?.status ===
    "conflicted",
  "The corrected SSE-S3 source conflict must remain Conflicted"
);

const auditedCourseId = "youtube:WZeZZ8_W-M4";
const auditedCourses = materials.filter(
  (material) => material.id === auditedCourseId
);
const expectedCourseChapters = [
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
];
requireValue(
  auditedCourses.length === 1,
  `${auditedCourseId}: exactly one course material is required`
);
const auditedCourse = auditedCourses[0];
requireValue(
  auditedCourse?.title ===
    "AWS Certified AI Practitioner (AIF-C01) – Full Course to PASS the Certification Exam",
  `${auditedCourseId}: canonical title is required`
);
requireValue(
  auditedCourse?.author === "freeCodeCamp.org",
  `${auditedCourseId}: canonical author is required`
);
requireValue(
  auditedCourse?.kind === "course" &&
    auditedCourse?.sourceUrl ===
      "https://www.youtube.com/watch?v=WZeZZ8_W-M4" &&
    auditedCourse?.role === "informational-syllabus-only" &&
    auditedCourse?.answerAuthority === false &&
    auditedCourse?.durationSeconds === 53928,
  `${auditedCourseId}: exact informational-only material contract is required`
);
requireValue(
  JSON.stringify(
    auditedCourse?.chapters?.map(
      ({ title, startSeconds, coverage }) => [
        title,
        startSeconds,
        coverage
      ]
    )
  ) === JSON.stringify(expectedCourseChapters),
  `${auditedCourseId}: exact chapter title, timestamp, and coverage contract is required`
);
requireValue(
  auditedCourse?.chapters?.every(
    (chapter, index, chapters) =>
      Number.isInteger(chapter.startSeconds) &&
      chapter.startSeconds >= 0 &&
      (index === 0 ||
        chapter.startSeconds > chapters[index - 1].startSeconds)
  ),
  `${auditedCourseId}: chapter timestamps must be increasing nonnegative integers`
);
for (const chapter of auditedCourse?.chapters ?? []) {
  requireValue(
    Array.isArray(chapter.domains) &&
      Array.isArray(chapter.tasks) &&
      Array.isArray(chapter.concepts),
    `${auditedCourseId}/${chapter.title}: domains, tasks, and concepts arrays are required`
  );
  requireValue(
    ["covered", "gap", "out-of-scope", "outdated"].includes(
      chapter.coverage
    ),
    `${auditedCourseId}/${chapter.title}: invalid coverage`
  );
  requireValue(
    typeof chapter.reason === "string" && chapter.reason.length > 0,
    `${auditedCourseId}/${chapter.title}: coverage reason is required`
  );
  requireValue(
    Array.isArray(chapter.verification) &&
      chapter.verification.length > 0 &&
      chapter.verification.every(
        (url) => isOfficialAwsDocumentationUrl(url)
      ),
    `${auditedCourseId}/${chapter.title}: verification must use an approved official authority URL`
  );
}

const rejectedClaims = auditedCourse?.rejectedClaims ?? [];
for (const rejected of rejectedClaims) {
  requireValue(
    Array.isArray(rejected.verification) &&
      rejected.verification.length > 0 &&
      rejected.verification.every((url) =>
        isOfficialAwsDocumentationUrl(url)
      ),
    `${auditedCourseId}/rejected claim "${rejected.claim}": verification must use an approved official authority URL`
  );
}
for (const [claim, currentRule] of [
  [
    "The exam duration is 120 minutes.",
    "The current exam duration is 90 minutes."
  ],
  [
    "Case studies are an exam interaction format.",
    "The current guide lists multiple choice, multiple response, ordering, and matching."
  ]
]) {
  requireValue(
    rejectedClaims.some(
      (rejected) =>
        rejected.claim === claim && rejected.currentRule === currentRule
    ),
    `${auditedCourseId}: missing rejected claim "${claim}"`
  );
}

const questionConcepts = new Set(
  questions.flatMap((question) => question.concepts)
);
const cheatSheetConcepts = new Set(
  cheatSheet.flatMap((entry) => entry.concepts)
);
for (const chapter of auditedCourse?.chapters ?? []) {
  if (chapter.coverage !== "gap") continue;
  for (const concept of chapter.concepts ?? []) {
    requireValue(
      questionConcepts.has(concept),
      `${auditedCourseId}/${chapter.title}: gap concept ${concept} has no question`
    );
    requireValue(
      cheatSheetConcepts.has(concept),
      `${auditedCourseId}/${chapter.title}: gap concept ${concept} has no cheat-sheet card`
    );
  }
}

const lakeFormationVerificationUrl =
  "https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html";
for (const questionId of [
  "aif-d5-aws-lake-formation-scenario",
  "aif-d5-aws-lake-formation-definition"
]) {
  const matchingQuestions = questions.filter(
    (question) => question.id === questionId
  );
  requireValue(
    matchingQuestions.length === 1,
    `${questionId}: exactly one generated Lake Formation question is required`
  );
  const question = matchingQuestions[0];
  requireValue(
    question?.origin === "official-addition" &&
      Array.isArray(question.sources) &&
      question.sources.length === 0 &&
      JSON.stringify(question.concepts) ===
        JSON.stringify(["aws-lake-formation"]),
    `${questionId}: must be an official addition without course provenance`
  );
  requireValue(
    question?.verification?.length === 1 &&
      question.verification[0].title ===
        "AWS documentation: AWS Lake Formation" &&
      question.verification[0].url === lakeFormationVerificationUrl &&
      question.verification[0].verifiedOn === "2026-07-29",
    `${questionId}: exact official Lake Formation verification is required`
  );
}
requireValue(
  !questions.some((question) =>
    question.sources?.some(
      (source) =>
        source.videoId === "WZeZZ8_W-M4" ||
        source.url?.includes("WZeZZ8_W-M4")
    )
  ),
  `${auditedCourseId}: informational course must not be question provenance`
);

const loadedPublicData = { ...finalCourseHandoff, videos };
requireValue(
  !/examtopics/i.test(JSON.stringify(loadedPublicData)),
  "Loaded public data must not contain ExamTopics references"
);

for (const [label, values] of [
  ["question IDs", questions.map((question) => question.id)],
  ["normalized prompts", questions.map((question) => normalizeText(question.prompt))]
]) {
  const duplicates = duplicateValues(values);
  requireValue(
    duplicates.length === 0,
    `Duplicate ${label}: ${duplicates.join(", ")}`
  );
}

const questionIds = new Set(questions.map((question) => question.id));
for (const entry of audit) {
  requireValue(
    typeof entry.reason === "string" && entry.reason.length > 0,
    `${entry.sourceKey}: audit reason is required`
  );
  if (entry.status === "pending") {
    requireValue(
      allowPending,
      `${entry.sourceKey}: source audit is still pending`
    );
  } else if (entry.status !== "excluded") {
    requireValue(
      questionIds.has(entry.questionId),
      `${entry.sourceKey}: final audit entry points to a missing question`
    );
  }
}

for (const entry of cheatSheet) {
  requireValue(
    isOfficialAwsDocumentationUrl(entry.sourceUrl),
    `${entry.id}: cheat-sheet source URL must use an approved official authority URL`
  );
}

for (const domain of [1, 2, 3, 4, 5]) {
  requireValue(
    cheatSheet.some(
      (entry) =>
        entry.domain === domain &&
        entry.memoryHook?.length > 0 &&
        entry.facts?.length > 0
    ),
    `Cheat sheet has no valid entry for Domain ${domain}`
  );
}

const correctionFields = [
  "Source:",
  "Question location:",
  "Question summary:",
  "Source stated:",
  "Verified answer:",
  "Why:",
  "Verification:",
  "Verified on:"
];
requireValue(
  corrections.includes("no confirmed errors") ||
    correctionFields.every((field) => corrections.includes(field)),
  "Correction report is missing its required entry contract"
);

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Content valid: ${questions.length} questions, ${audit.length} source records, ${cheatSheet.length} memory notes${allowPending ? " (pending source audit allowed)" : ""}.`
);
