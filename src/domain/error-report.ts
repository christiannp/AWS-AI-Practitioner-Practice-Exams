import type {
  Answer,
  AppContent,
  LearnerState,
  Question
} from "../data/types";

function expectedAnswer(question: Question): Answer {
  switch (question.type) {
    case "multiple-choice":
      return question.correctId;
    case "multiple-response":
      return question.correctIds;
    case "ordering":
      return question.correctOrder;
    case "matching":
      return question.correctMatches;
  }
}

function choiceLabel(
  question: Extract<
    Question,
    { type: "multiple-choice" | "multiple-response" }
  >,
  id: string
): string {
  const option = question.options.find((candidate) => candidate.id === id);
  return option ? `${option.id.toUpperCase()}. ${option.text}` : id;
}

function formatReportAnswer(question: Question, answer: Answer): string {
  if (
    answer === "" ||
    (Array.isArray(answer) && answer.length === 0) ||
    (typeof answer === "object" &&
      !Array.isArray(answer) &&
      Object.keys(answer).length === 0)
  ) {
    return "(No answer submitted)";
  }

  switch (question.type) {
    case "multiple-choice":
      return choiceLabel(question, typeof answer === "string" ? answer : "");
    case "multiple-response": {
      const ids = Array.isArray(answer) ? answer : [];
      return `\n${ids
        .map((id) => `  - ${choiceLabel(question, id)}`)
        .join("\n")}`;
    }
    case "ordering": {
      const ids = Array.isArray(answer) ? answer : [];
      return `\n${ids
        .map((id, index) => {
          const item = question.items.find((candidate) => candidate.id === id);
          return `  ${index + 1}. ${item?.text ?? id}`;
        })
        .join("\n")}`;
    }
    case "matching": {
      const matches =
        typeof answer === "object" && !Array.isArray(answer) ? answer : {};
      return `\n${question.prompts
        .map((prompt) => {
          const targetId = matches[prompt.id];
          const target = question.targets.find(
            (candidate) => candidate.id === targetId
          );
          return `  - ${prompt.text} → ${target?.text ?? targetId ?? "(No match)"}`;
        })
        .join("\n")}`;
    }
  }
}

function answerField(label: string, formatted: string): string {
  return formatted.startsWith("\n")
    ? `${label}:${formatted}`
    : `${label}: ${formatted}`;
}

export function learnerErrorReportText(
  content: AppContent,
  state: LearnerState,
  generatedAt: Date
): string {
  const questionById = new Map(
    content.questions.map((question) => [question.id, question])
  );
  const errors = Object.values(state.attempts)
    .flat()
    .filter((attempt) => !attempt.correct)
    .map((attempt, index) => ({ attempt, index }))
    .sort(
      (left, right) =>
        left.attempt.completedAt.localeCompare(right.attempt.completedAt) ||
        left.index - right.index
    );
  const usedHistoryIndexes = new Set<number>();
  const sections = errors.map(({ attempt }, index) => {
    const historyIndex = state.wrongHistory.findIndex(
      (entry, candidateIndex) =>
        !usedHistoryIndexes.has(candidateIndex) &&
        entry.questionId === attempt.questionId &&
        entry.completedAt === attempt.completedAt &&
        JSON.stringify(entry.answer) === JSON.stringify(attempt.answer)
    );
    const history =
      historyIndex >= 0 ? state.wrongHistory[historyIndex] : undefined;
    if (historyIndex >= 0) usedHistoryIndexes.add(historyIndex);
    const question = questionById.get(attempt.questionId);
    if (!question) {
      const submitted =
        typeof attempt.answer === "string"
          ? attempt.answer || "(No answer submitted)"
          : JSON.stringify(attempt.answer);
      return [
        `ERROR ATTEMPT ${index + 1}`,
        `Timestamp: ${attempt.completedAt}`,
        `Practice Exam: ${history?.examId ?? "Unavailable"}`,
        `Round ID: ${history?.roundId ?? "Unavailable"}`,
        `Question ID: ${attempt.questionId}`,
        "Domain: Unavailable",
        "Task: Unavailable",
        "Type: Unavailable",
        "Prompt: Question is no longer present in this content version.",
        `Your submitted answer: ${submitted}`,
        "Correct answer: Unavailable",
        "Explanation: Unavailable",
        "Official verification sources: Unavailable"
      ].join("\n");
    }

    const verification = question.verification
      .map(
        (reference) =>
          `- ${reference.title} — ${reference.url} (verified ${reference.verifiedOn})`
      )
      .join("\n");
    return [
      `ERROR ATTEMPT ${index + 1}`,
      `Timestamp: ${attempt.completedAt}`,
      `Practice Exam: ${history?.examId ?? "Unavailable"}`,
      `Round ID: ${history?.roundId ?? "Unavailable"}`,
      `Question ID: ${question.id}`,
      `Domain: ${question.domain}`,
      `Task: ${question.task}`,
      `Type: ${question.type.replaceAll("-", " ")}`,
      `Prompt: ${question.prompt}`,
      answerField(
        "Your submitted answer",
        formatReportAnswer(question, attempt.answer)
      ),
      answerField(
        "Correct answer",
        formatReportAnswer(question, expectedAnswer(question))
      ),
      `Explanation: ${question.explanation}`,
      "Official verification sources:",
      verification || "(None)"
    ].join("\n");
  });

  return [
    "AWS AI Practitioner — Detailed Learner Error Report",
    `Generated: ${generatedAt.toISOString()}`,
    `Incorrect attempts: ${errors.length}`,
    "",
    sections.length > 0
      ? sections.join("\n\n" + "=".repeat(72) + "\n\n")
      : "No incorrect attempts have been recorded.",
    ""
  ].join("\n");
}
