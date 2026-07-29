import { describe, expect, it } from "vitest";

import { segmentCaptionQuestions } from "../scripts/extract-source-drafts.mjs";

describe("caption question segmentation", () => {
  it("separates prompts, stated answers, and explanations around answer reveals", () => {
    const captions = [
      { startSeconds: 0, durationSeconds: 2, text: "Welcome to the session." },
      {
        startSeconds: 5,
        durationSeconds: 2,
        text: "Question number one. Which service analyzes text?"
      },
      {
        startSeconds: 8,
        durationSeconds: 2,
        text: "Choose the best answer."
      },
      {
        startSeconds: 15,
        durationSeconds: 2,
        text: "Correct answer. Amazon Comprehend."
      },
      {
        startSeconds: 17,
        durationSeconds: 2,
        text: "Explanation. It extracts entities and sentiment."
      },
      {
        startSeconds: 24,
        durationSeconds: 2,
        text: "Question number two. Which service analyzes images?"
      },
      {
        startSeconds: 34,
        durationSeconds: 2,
        text: "Correct answer. Amazon Rekognition."
      },
      {
        startSeconds: 36,
        durationSeconds: 2,
        text: "Explanation. It detects labels in images."
      }
    ];

    expect(segmentCaptionQuestions(captions, 2, 1)).toEqual([
      {
        questionNumber: 1,
        timestampSeconds: 5,
        prompt: "Which service analyzes text? Choose the best answer.",
        statedAnswer: "Amazon Comprehend.",
        explanation: "It extracts entities and sentiment."
      },
      {
        questionNumber: 2,
        timestampSeconds: 24,
        prompt: "Which service analyzes images?",
        statedAnswer: "Amazon Rekognition.",
        explanation: "It detects labels in images."
      }
    ]);
  });

  it("selects one reveal per question when narration repeats the phrase correct answer", () => {
    const captions = [
      {
        startSeconds: 0,
        durationSeconds: 2,
        text: "First question of the series. Which service analyzes text?"
      },
      {
        startSeconds: 9,
        durationSeconds: 2,
        text: "Take time to guess the correct answer."
      },
      {
        startSeconds: 15,
        durationSeconds: 2,
        text: "The correct answer here will be Amazon Comprehend."
      },
      {
        startSeconds: 17,
        durationSeconds: 2,
        text: "This is because it extracts entities and sentiment."
      },
      {
        startSeconds: 24,
        durationSeconds: 2,
        text: "That is the correct answer. Now question number"
      },
      {
        startSeconds: 26,
        durationSeconds: 2,
        text: "two. Which service analyzes images?"
      },
      {
        startSeconds: 39,
        durationSeconds: 2,
        text: "The correct answer here will be Amazon Rekognition."
      },
      {
        startSeconds: 41,
        durationSeconds: 2,
        text: "This is because it detects labels in images."
      },
      {
        startSeconds: 47,
        durationSeconds: 2,
        text: "Rekognition is the correct answer."
      }
    ];

    expect(segmentCaptionQuestions(captions, 2, 1)).toEqual([
      {
        questionNumber: 1,
        timestampSeconds: 0,
        prompt: "Which service analyzes text? Take time to guess the correct answer.",
        statedAnswer: "Amazon Comprehend.",
        explanation: "it extracts entities and sentiment."
      },
      {
        questionNumber: 2,
        timestampSeconds: 24,
        prompt: "Which service analyzes images?",
        statedAnswer: "Amazon Rekognition.",
        explanation: "it detects labels in images. Rekognition is the correct answer."
      }
    ]);
  });

  it("uses narration gaps to keep an answer explanation out of the next prompt", () => {
    const captions = [
      {
        startSeconds: 0,
        durationSeconds: 2,
        text: "Which data supports few shot intent detection?"
      },
      {
        startSeconds: 10,
        durationSeconds: 2,
        text: "Correct answer. Pairs of user messages"
      },
      {
        startSeconds: 12,
        durationSeconds: 2,
        text: "and correct intents. Explanation. These are labeled examples."
      },
      {
        startSeconds: 14,
        durationSeconds: 10,
        text: "Why others are incorrect? Generic text is not task specific."
      },
      {
        startSeconds: 22,
        durationSeconds: 2,
        text: "A company must adapt a model. Which data format should it use?"
      },
      {
        startSeconds: 32,
        durationSeconds: 2,
        text: "Correct answer. Prompt and completion pairs."
      },
      {
        startSeconds: 34,
        durationSeconds: 2,
        text: "Explanation. The pairs provide labeled examples."
      }
    ];

    expect(segmentCaptionQuestions(captions, 2, 1)).toEqual([
      {
        questionNumber: 1,
        timestampSeconds: 0,
        prompt: "Which data supports few shot intent detection?",
        statedAnswer: "Pairs of user messages and correct intents.",
        explanation: "These are labeled examples."
      },
      {
        questionNumber: 2,
        timestampSeconds: 22,
        prompt: "A company must adapt a model. Which data format should it use?",
        statedAnswer: "Prompt and completion pairs.",
        explanation: "The pairs provide labeled examples."
      }
    ]);
  });
});
