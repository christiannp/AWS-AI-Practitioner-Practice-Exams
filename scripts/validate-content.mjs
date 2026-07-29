import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  fingerprintQuestion,
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
      verification.url?.startsWith("https://"),
      `${question.id}: verification URL must use HTTPS`
    );
    requireValue(
      verification.verifiedOn >= "2026-07-29",
      `${question.id}: verification date is stale or missing`
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

const [questions, audit, videos, cheatSheet, corrections] = await Promise.all([
  readJson("public/data/questions.json"),
  readJson("public/data/source-audit.json"),
  readJson("public/data/source-videos.json"),
  readJson("public/data/cheat-sheet.json"),
  readFile(path.join(root, "source-answer-corrections.txt"), "utf8")
]);

const videoIds = new Set(videos.map((video) => video.videoId));
for (const question of questions) validateQuestion(question, videoIds);

for (const [label, values] of [
  ["question IDs", questions.map((question) => question.id)],
  ["normalized prompts", questions.map((question) => normalizeText(question.prompt))],
  ["fingerprints", questions.map((question) => question.fingerprint)]
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

for (const domain of [1, 2, 3, 4, 5]) {
  requireValue(
    cheatSheet.some(
      (entry) =>
        entry.domain === domain &&
        entry.memoryHook?.length > 0 &&
        entry.facts?.length > 0 &&
        entry.sourceUrl?.startsWith("https://")
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
