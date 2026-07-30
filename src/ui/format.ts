import type { Answer, Question } from "../data/types";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function answerIsEmpty(answer: Answer | undefined): boolean {
  if (answer === undefined || answer === "") return true;
  if (Array.isArray(answer)) return answer.length === 0;
  return Object.keys(answer).length === 0;
}

export function answerIsComplete(
  question: Question,
  answer: Answer | undefined
): boolean {
  if (answerIsEmpty(answer)) return false;
  if (
    question.type === "ordering" &&
    (!Array.isArray(answer) || answer.length !== question.items.length)
  ) {
    return false;
  }
  if (question.type === "matching") {
    if (typeof answer !== "object" || Array.isArray(answer)) return false;
    return question.prompts.every((prompt) => Boolean(answer[prompt.id]));
  }
  return true;
}

export function initialOrderingAnswer(
  question: Extract<Question, { type: "ordering" }>
): string[] {
  const itemOrder = question.items.map((item) => item.id);
  return itemOrder.length > 1 &&
    itemOrder.every((id, index) => question.correctOrder[index] === id)
    ? [...itemOrder.slice(1), itemOrder[0]!]
    : itemOrder;
}

function choiceText(question: Question, id: string): string {
  if (question.type !== "multiple-choice" && question.type !== "multiple-response") {
    return id;
  }
  return question.options.find((option) => option.id === id)?.text ?? id;
}

export function formatAnswer(question: Question, answer: Answer): string {
  if (typeof answer === "string") return choiceText(question, answer) || "No answer";
  if (Array.isArray(answer)) {
    if (question.type === "ordering") {
      return answer
        .map(
          (id) => question.items.find((item) => item.id === id)?.text ?? id
        )
        .join(" → ");
    }
    return answer.map((id) => choiceText(question, id)).join("; ");
  }
  if (question.type === "matching") {
    return question.prompts
      .map((prompt) => {
        const targetId = answer[prompt.id];
        const target = question.targets.find((item) => item.id === targetId);
        return `${prompt.text} → ${target?.text ?? "Not matched"}`;
      })
      .join("; ");
  }
  return "No answer";
}
