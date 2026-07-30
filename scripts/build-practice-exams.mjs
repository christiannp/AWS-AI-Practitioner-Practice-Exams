import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, "public", "data");
const conflictId = "aif-d5-sse-s3-object-access-scenario";

const questions = JSON.parse(
  await readFile(path.join(dataDirectory, "questions.json"), "utf8")
);
const questionById = new Map(
  questions.map((question) => [question.id, question])
);
const verified = questions.filter((question) => question.id !== conflictId);

function stableQuestions(items) {
  const ordered = [...items].sort(
    (left, right) =>
      left.task.localeCompare(right.task) ||
      left.id.localeCompare(right.id)
  );
  const exam = ordered.filter((question) => question.difficulty === "exam");
  const foundation = ordered.filter(
    (question) => question.difficulty === "foundation"
  );
  const mixed = [];
  for (
    let index = 0;
    index < Math.max(exam.length, foundation.length);
    index += 1
  ) {
    if (exam[index]) mixed.push(exam[index]);
    if (foundation[index]) mixed.push(foundation[index]);
  }
  return mixed;
}

const pools = new Map(
  [1, 2, 3, 4, 5].map((domain) => [
    domain,
    stableQuestions(verified.filter((question) => question.domain === domain))
  ])
);
const basePerExam = new Map([
  [1, 22],
  [2, 14],
  [3, 13],
  [4, 6],
  [5, 10]
]);

const exams = Array.from({ length: 4 }, (_, examIndex) => {
  const questionIds = [];
  for (const domain of [1, 2, 3, 4, 5]) {
    const count = basePerExam.get(domain);
    const pool = pools.get(domain);
    const start = examIndex * count;
    questionIds.push(
      ...pool.slice(start, start + count).map((question) => question.id)
    );
  }
  return {
    id: examIndex + 1,
    title: `Practice Exam ${examIndex + 1}`,
    version: 1,
    questionIds
  };
});

const used = new Set(exams.flatMap((exam) => exam.questionIds));
const remaining = stableQuestions(
  verified.filter((question) => !used.has(question.id))
);
const repeatTargets = new Map([
  [1, 12],
  [2, 15],
  [3, 17],
  [4, 8],
  [5, 6]
]);
const repeated = [];
for (const domain of [1, 2, 3, 4, 5]) {
  const candidates = pools
    .get(domain)
    .filter((question) => !remaining.some((item) => item.id === question.id));
  repeated.push(
    ...candidates
      .slice(0, repeatTargets.get(domain))
      .map((question) => question.id)
  );
}

exams.push({
  id: 5,
  title: "Practice Exam 5",
  version: 1,
  questionIds: [...remaining.map((question) => question.id), ...repeated]
});

const reviews = questions.map((question) => {
  if (question.id !== conflictId) {
    return {
      questionId: question.id,
      status: "verified",
      reason: "The app answer is supported by the linked official AWS documentation.",
      proof: question.verification
    };
  }

  return {
    questionId: question.id,
    status: "conflicted",
    reason:
      "The source answer required AWS KMS decrypt permission, but SSE-S3 uses Amazon S3 managed keys. Reading the object requires s3:GetObject; no separate KMS decrypt permission is required.",
    sourceClaim:
      "Grant AWS KMS decrypt permission to read objects encrypted with SSE-S3.",
    proof: question.verification
  };
});

for (const exam of exams) {
  if (exam.questionIds.length !== 65) {
    throw new Error(
      `${exam.title} must contain 65 questions; found ${exam.questionIds.length}.`
    );
  }
  if (new Set(exam.questionIds).size !== exam.questionIds.length) {
    throw new Error(`${exam.title} contains a duplicate question ID.`);
  }
}
if (reviews.length !== questions.length) {
  throw new Error("Every question must have exactly one review record.");
}
if (!questionById.has(conflictId)) {
  throw new Error(`Conflict question ${conflictId} is missing.`);
}

await Promise.all([
  writeFile(
    path.join(dataDirectory, "practice-exams.json"),
    `${JSON.stringify(exams, null, 2)}\n`
  ),
  writeFile(
    path.join(dataDirectory, "question-reviews.json"),
    `${JSON.stringify(reviews, null, 2)}\n`
  )
]);

console.log(
  `Generated ${exams.length} practice exams and ${reviews.length} review records.`
);
