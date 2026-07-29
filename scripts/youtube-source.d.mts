export interface CaptionSegment {
  startSeconds: number;
  durationSeconds: number;
  text: string;
}

export function captionsFromXml(xml: string): CaptionSegment[];
