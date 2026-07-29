export interface ExamTopicsChoice {
  code: string;
  text: string;
}

export interface ExamTopicsItem {
  sourceKey: string;
  pageNumber: number;
  questionNumber: number;
  sourceUrl: string;
  prompt: string;
  choices: ExamTopicsChoice[];
  sourceAnswerCodes: string[];
  communityVotes: unknown[];
  sourcePromptHash: string;
}

export interface FetchExamTopicsCorpusOptions {
  root?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  refresh?: boolean;
}

export function extractExamTopicsPage(
  html: string,
  pageNumber: number,
  pageUrl: string
): ExamTopicsItem[];

export function fetchExamTopicsCorpus(
  options?: FetchExamTopicsCorpusOptions
): Promise<ExamTopicsItem[]>;
