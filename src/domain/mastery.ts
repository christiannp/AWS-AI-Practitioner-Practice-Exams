import type { LearnerState, Question } from "../data/types";

const BASELINE_MASTERY = 0.35;
const CORRECT_INCREMENT = 0.15;
const INCORRECT_DECREMENT = 0.2;
const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

function clampScore(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function conceptMastery(
  state: LearnerState,
  concept: string
): number {
  return state.mastery[concept]?.score ?? BASELINE_MASTERY;
}

export function recordAttempt(
  state: LearnerState,
  question: Question,
  correct: boolean,
  completedAt: string
): LearnerState {
  const completedDate = completedAt.slice(0, 10);
  const attempts = {
    ...state.attempts,
    [question.id]: [
      ...(state.attempts[question.id] ?? []),
      {
        questionId: question.id,
        answer: "",
        correct,
        completedAt
      }
    ]
  };
  const mastery = { ...state.mastery };

  for (const concept of question.concepts) {
    const previous = mastery[concept] ?? {
      score: BASELINE_MASTERY,
      successStreak: 0,
      dueOn: completedDate
    };

    if (!correct) {
      mastery[concept] = {
        score: clampScore(previous.score - INCORRECT_DECREMENT),
        successStreak: 0,
        dueOn: addUtcDays(completedDate, 1)
      };
      continue;
    }

    const successStreak = previous.successStreak + 1;
    const interval =
      REVIEW_INTERVALS[
        Math.min(successStreak - 1, REVIEW_INTERVALS.length - 1)
      ]!;
    mastery[concept] = {
      score: clampScore(previous.score + CORRECT_INCREMENT),
      successStreak,
      dueOn: addUtcDays(completedDate, interval)
    };
  }

  return {
    ...state,
    attempts,
    mastery
  };
}
