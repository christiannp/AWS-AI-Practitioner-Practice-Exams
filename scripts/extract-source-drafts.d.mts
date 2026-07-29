export interface CaptionSegment {
  startSeconds: number;
  durationSeconds: number;
  text: string;
}

export interface SourceQuestionDraft {
  questionNumber: number;
  timestampSeconds: number;
  prompt: string;
  statedAnswer: string;
  explanation: string;
}

export function segmentCaptionQuestions(
  captions: CaptionSegment[],
  expectedCount: number,
  firstQuestionNumber?: number
): SourceQuestionDraft[];
