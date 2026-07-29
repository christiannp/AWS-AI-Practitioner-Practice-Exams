import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fingerprintQuestion, normalizeText } from "./normalize-question.mjs";
import { concepts } from "./question-catalog.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const verifiedOn = "2026-07-29";
const visualVideoId = "Di_tP3QRSHE";
const correctedSourceKeys = new Set(["yrkju-Ch7ME:9"]);
const forcedConceptBySourceKey = new Map([
  ["yrkju-Ch7ME:9", "sse-s3-object-access"],
  ["b7m5BOwufLI:458", "intellectual-property"],
  ["tajOPpheBZs:339", "human-centered-explainability"],
  ["PgnM3sK26wk:184", "regional-coverage"],
  ["PgnM3sK26wk:197", "data-lifecycle-governance"],
  ["mAQsr0MRKz0:161", "transfer-learning"],
  ["omwHZOaBRA0:133", "decision-tree"],
  ["omwHZOaBRA0:143", "transfer-learning"],
  ["myhFBIR4iqg:113", "anomaly-detection"],
  ["myhFBIR4iqg:115", "time-series-forecasting"],
  ["myhFBIR4iqg:117", "time-series-forecasting"],
  ["myhFBIR4iqg:119", "anomaly-detection"],
  ["myhFBIR4iqg:123", "anomaly-detection"],
  ["D3maw2tvEZI:69", "anomaly-detection"],
  ["Gygz_c08Nv4:26", "time-series-forecasting"],
  ["Gygz_c08Nv4:30", "time-series-forecasting"],
  ["Gygz_c08Nv4:33", "anomaly-detection"],
  ["Gygz_c08Nv4:35", "computer-vision"],
  ["Gygz_c08Nv4:40", "anomaly-detection"],
  ["g2izz8CxCv8:16", "amazon-textract"],
  ["g2izz8CxCv8:22", "anomaly-detection"],
  ["yvZGZrDQSB4:56", "fairness"]
]);
const supersededProductSourceKeys = new Set([
  "myhFBIR4iqg:113",
  "myhFBIR4iqg:115",
  "myhFBIR4iqg:117",
  "myhFBIR4iqg:119",
  "myhFBIR4iqg:123",
  "D3maw2tvEZI:69",
  "Gygz_c08Nv4:26",
  "Gygz_c08Nv4:30",
  "Gygz_c08Nv4:33",
  "Gygz_c08Nv4:35",
  "Gygz_c08Nv4:40",
  "g2izz8CxCv8:22"
]);

const visualConceptKeys = [
  "classification",
  "amazon-textract",
  "amazon-polly",
  "sagemaker-canvas",
  "amazon-lex",
  "amazon-translate",
  "amazon-kendra",
  "amazon-transcribe",
  "amazon-textract",
  "amazon-comprehend",
  "sagemaker-canvas",
  "regression",
  "amazon-cloudwatch",
  "amazon-quick",
  "aws-glue",
  "sagemaker-jumpstart",
  "generative-adversarial-network",
  "amazon-comprehend",
  "bedrock-knowledge-bases",
  "fine-tuning",
  "aws-privatelink",
  "aws-glue",
  "amazon-comprehend",
  "amazon-textract",
  "amazon-personalize",
  "sagemaker-jumpstart",
  "amazon-a2i",
  "amazon-comprehend",
  "aws-privatelink",
  "sagemaker-model-cards",
  "fine-tuning",
  "embeddings",
  "aws-audit-manager",
  "sagemaker-canvas",
  "amazon-s3",
  "fairness",
  "rag",
  "ai-governance",
  "sagemaker-feature-store",
  "generative-ai",
  "unsupervised-learning",
  "ai-governance",
  "negative-prompting",
  "aws-cloudtrail",
  "benchmark-dataset",
  "few-shot-prompting",
  "amazon-textract",
  "sagemaker-clarify",
  "overfitting",
  "iam-least-privilege",
  "token-pricing",
  "regression",
  "amazon-bedrock",
  "aws-config",
  "rouge",
  "feature-engineering",
  "explainability",
  "fairness",
  "amazon-comprehend",
  "generative-ai",
  "benchmark-dataset",
  "aws-glue",
  "latent-space",
  "embeddings",
  "amazon-comprehend"
];

function tokenize(value) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 4)
  );
}

function keywordScore(text, answerText, concept) {
  const normalized = normalizeText(text);
  const normalizedAnswer = normalizeText(answerText);
  let score = 0;

  for (const keyword of concept.keywords) {
    const phrase = normalizeText(keyword);
    if (!phrase) continue;
    const wordCount = phrase.split(" ").length;
    if (normalized.includes(phrase)) score += 5 + wordCount * 4;
    if (normalizedAnswer.includes(phrase)) score += 12 + wordCount * 7;
  }

  const sourceTokens = tokenize(`${text} ${answerText}`);
  const conceptTokens = tokenize(
    `${concept.answer} ${concept.need} ${concept.definition}`
  );
  let overlap = 0;
  for (const token of conceptTokens) {
    if (sourceTokens.has(token)) overlap += 1;
  }
  score += Math.min(overlap, 5);
  return score;
}

function bestConcept(draft) {
  const text = `${draft.prompt} ${draft.explanation}`;
  return concepts
    .map((concept) => ({
      concept,
      score: keywordScore(text, draft.statedAnswer, concept)
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.concept.key.localeCompare(right.concept.key)
    )[0];
}

function conciseSummary(concept) {
  return `Tests when to use ${concept.answer}: ${concept.need}.`.slice(0, 180);
}

function sourceRef(entry) {
  return {
    playlistId: entry.playlistId,
    videoId: entry.videoId,
    videoTitle: entry.videoTitle,
    url: entry.sourceUrl,
    questionNumber: entry.questionNumber,
    timestampSeconds: entry.timestampSeconds
  };
}

function isService(answer) {
  return /^(?:Amazon|AWS|SageMaker|Kiro|Strands|Policy in Amazon)/.test(
    answer
  );
}

function lowerFirst(value) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function rotatedDistractors(concept, conceptIndex) {
  const sameDomain = concepts.filter(
    (candidate) =>
      candidate.domain === concept.domain && candidate.key !== concept.key
  );
  const selected = [];
  for (let offset = 1; selected.length < 3; offset += 1) {
    const candidate =
      sameDomain[(conceptIndex * 5 + offset * 7) % sameDomain.length];
    if (!selected.some((item) => item.key === candidate.key)) {
      selected.push(candidate);
    }
  }
  return selected;
}

function orderedChoices(correct, distractors, correctIndex) {
  const choices = [...distractors];
  choices.splice(correctIndex, 0, correct);
  return choices.map((choice, index) => ({
    ...choice,
    optionId: String.fromCharCode(97 + index)
  }));
}

function commonQuestionFields(concept, id, sourceEntries, difficulty) {
  const sources = sourceEntries.slice(0, 6).map(sourceRef);
  return {
    id,
    origin: sources.length > 0 ? "source-derived" : "official-addition",
    type: "multiple-choice",
    domain: concept.domain,
    task: concept.task,
    difficulty,
    concepts: [concept.key],
    services: isService(concept.answer) ? [concept.answer] : [],
    sources,
    verification: [
      {
        title: `AWS documentation: ${concept.answer}`,
        url: concept.verification,
        verifiedOn
      }
    ]
  };
}

function makeScenarioQuestion(concept, conceptIndex, sourceEntries) {
  const id = `aif-d${concept.domain}-${concept.key}-scenario`;
  const prompt = `A team needs to ${concept.need}. Which option best meets this requirement?`;
  const correctIndex = conceptIndex % 4;
  const choices = orderedChoices(
    concept,
    rotatedDistractors(concept, conceptIndex),
    correctIndex
  );
  const question = {
    ...commonQuestionFields(concept, id, sourceEntries, "exam"),
    prompt,
    options: choices.map((choice) => ({
      id: choice.optionId,
      text: choice.answer,
      ...(choice.key === concept.key
        ? {}
        : {
            distractorReason: `${choice.answer} ${lowerFirst(
              choice.definition
            )} It does not directly satisfy the stated requirement.`
          })
    })),
    correctId: choices.find((choice) => choice.key === concept.key).optionId,
    explanation: `${concept.answer} is the best fit because it ${lowerFirst(
      concept.definition
    )}`
  };
  question.fingerprint = fingerprintQuestion(
    question.prompt,
    question.concepts
  );
  return question;
}

function makeDefinitionQuestion(concept, conceptIndex, sourceEntries) {
  const id = `aif-d${concept.domain}-${concept.key}-definition`;
  const prompt = `Which description best matches ${concept.answer}?`;
  const correctIndex = (conceptIndex + 2) % 4;
  const choices = orderedChoices(
    concept,
    rotatedDistractors(concept, conceptIndex + 11),
    correctIndex
  );
  const question = {
    ...commonQuestionFields(concept, id, sourceEntries, "foundation"),
    prompt,
    options: choices.map((choice) => ({
      id: choice.optionId,
      text: choice.definition,
      ...(choice.key === concept.key
        ? {}
        : {
            distractorReason: `This describes ${choice.answer}, not ${concept.answer}.`
          })
    })),
    correctId: choices.find((choice) => choice.key === concept.key).optionId,
    explanation: `${concept.answer} ${lowerFirst(concept.definition)}`,
  };
  question.fingerprint = fingerprintQuestion(
    question.prompt,
    question.concepts
  );
  return question;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function main() {
  const [originalAudit, drafts, specialQuestions] = await Promise.all([
    readJson("public/data/source-audit.json"),
    readJson(".source-cache/source-drafts.json"),
    readJson("public/data/questions.json")
  ]);
  const conceptByKey = new Map(concepts.map((concept) => [concept.key, concept]));
  const draftBySourceKey = new Map(
    drafts.map((draft) => [draft.sourceKey, draft])
  );
  const sourcesByConcept = new Map(
    concepts.map((concept) => [concept.key, []])
  );
  const mappedAudit = [];
  const matchScores = [];

  for (const entry of originalAudit) {
    const draft = draftBySourceKey.get(entry.sourceKey);
    let concept;
    let score = 0;

    if (forcedConceptBySourceKey.has(entry.sourceKey)) {
      concept = conceptByKey.get(
        forcedConceptBySourceKey.get(entry.sourceKey)
      );
      score = 100;
    } else if (entry.videoId === visualVideoId) {
      concept = conceptByKey.get(
        visualConceptKeys[entry.questionNumber - 1]
      );
      score = 100;
    } else if (draft) {
      const best = bestConcept(draft);
      concept = best.concept;
      score = best.score;
    }

    if (!concept || score < 7) {
      mappedAudit.push({
        ...entry,
        timestampSeconds:
          draft?.timestampSeconds ?? entry.timestampSeconds ?? 0,
        promptSummary:
          "Source item could not be mapped to a current objective with sufficient confidence.",
        statedAnswer: draft?.statedAnswer ?? "",
        status: "excluded",
        reason:
          "Excluded because the recovered source wording was incomplete or could not be verified against a current AIF-C01 objective."
      });
      continue;
    }

    const questionId = `aif-d${concept.domain}-${concept.key}-scenario`;
    const mapped = {
      ...entry,
      timestampSeconds:
        draft?.timestampSeconds ?? entry.timestampSeconds ?? 0,
      sourceUrl: entry.sourceUrl.replace(
        /&t=\d+s$/,
        `&t=${draft?.timestampSeconds ?? entry.timestampSeconds ?? 0}s`
      ),
      promptSummary: conciseSummary(concept),
      statedAnswer: draft?.statedAnswer ?? "",
      questionId,
      status: correctedSourceKeys.has(entry.sourceKey)
        ? "corrected"
        : "merged",
      reason: correctedSourceKeys.has(entry.sourceKey)
        ? "The source answer is corrected in source-answer-corrections.txt and the linked practice item teaches the verified rule."
        : supersededProductSourceKeys.has(entry.sourceKey)
          ? `The video names a product that is not in the current AIF-C01 in-scope list. Its underlying requirement is retained as the verified ${concept.answer} concept.`
        : `Mapped to the verified ${concept.answer} concept; equivalent source coverage is consolidated to avoid duplicate practice wording.`
    };
    sourcesByConcept.get(concept.key).push(mapped);
    mappedAudit.push(mapped);
    matchScores.push(score);
  }

  for (const sourceEntries of sourcesByConcept.values()) {
    const first = sourceEntries.find(
      (entry) => entry.status !== "corrected"
    );
    if (first) {
      first.status = "included";
      first.reason =
        "Primary retained source reference for this verified concept; the practice wording is original.";
    }
  }

  const generatedQuestions = concepts.flatMap((concept, index) => {
    const sourceEntries = sourcesByConcept.get(concept.key);
    return [
      makeScenarioQuestion(concept, index, sourceEntries),
      makeDefinitionQuestion(concept, index, sourceEntries)
    ];
  });
  const retainedSpecialQuestions = specialQuestions.filter((question) =>
    /^aif-d\d-0001$/.test(question.id)
  );
  const questions = [...generatedQuestions, ...retainedSpecialQuestions];

  await Promise.all([
    writeFile(
      path.join(root, "public/data/questions.json"),
      `${JSON.stringify(questions, null, 2)}\n`
    ),
    writeFile(
      path.join(root, "public/data/source-audit.json"),
      `${JSON.stringify(mappedAudit, null, 2)}\n`
    )
  ]);

  const statusCounts = Object.fromEntries(
    ["included", "merged", "corrected", "excluded"].map((status) => [
      status,
      mappedAudit.filter((entry) => entry.status === status).length
    ])
  );
  const sourceDerivedConcepts = [...sourcesByConcept.values()].filter(
    (entries) => entries.length > 0
  ).length;
  console.log(
    JSON.stringify(
      {
        questions: questions.length,
        concepts: concepts.length,
        sourceDerivedConcepts,
        statusCounts,
        matchScore: {
          minimum: Math.min(...matchScores),
          average:
            Math.round(
              (matchScores.reduce((sum, value) => sum + value, 0) /
                matchScores.length) *
                10
            ) / 10
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
