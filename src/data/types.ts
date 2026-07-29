export type QuestionType =
  | "multiple-choice"
  | "multiple-response"
  | "ordering"
  | "matching";

export type Answer = string | string[] | Record<string, string>;
export type Domain = 1 | 2 | 3 | 4 | 5;

export interface SourceRef {
  playlistId: string;
  videoId: string;
  videoTitle: string;
  url: string;
  questionNumber?: number;
  timestampSeconds?: number;
}

export interface SourceVideo {
  playlistId: string;
  videoId: string;
  title: string;
  url: string;
  durationSeconds: number;
  kind: "questions" | "informational";
}

export interface VerificationRef {
  title: string;
  url: string;
  verifiedOn: string;
}

export interface QuestionBase {
  id: string;
  origin: "source-derived" | "official-addition";
  type: QuestionType;
  prompt: string;
  domain: Domain;
  task: string;
  difficulty: "foundation" | "exam";
  concepts: string[];
  services: string[];
  explanation: string;
  sources: SourceRef[];
  verification: VerificationRef[];
  fingerprint: string;
}

export interface ChoiceOption {
  id: string;
  text: string;
  distractorReason?: string;
}

export type Question =
  | (QuestionBase & {
      type: "multiple-choice";
      options: ChoiceOption[];
      correctId: string;
    })
  | (QuestionBase & {
      type: "multiple-response";
      options: ChoiceOption[];
      correctIds: string[];
    })
  | (QuestionBase & {
      type: "ordering";
      items: Array<{ id: string; text: string }>;
      correctOrder: string[];
    })
  | (QuestionBase & {
      type: "matching";
      prompts: Array<{ id: string; text: string }>;
      targets: Array<{ id: string; text: string }>;
      correctMatches: Record<string, string>;
    });

export interface Attempt {
  questionId: string;
  answer: Answer;
  correct: boolean;
  completedAt: string;
}

export interface StudySession {
  id: string;
  mode: "daily" | "mock" | "source";
  questionIds: string[];
  completedAt: string;
  correctCount: number;
}

export interface MasteryRecord {
  score: number;
  successStreak: number;
  dueOn: string;
}

export interface LearnerState {
  version: 1;
  settings: { targetDate: string };
  attempts: Record<string, Attempt[]>;
  mastery: Record<string, MasteryRecord>;
  sessions: StudySession[];
  inProgress?: {
    id: string;
    mode: StudySession["mode"];
    questionIds: string[];
    answers: Record<string, Answer>;
    currentIndex: number;
  };
}

export interface CheatSheetEntry {
  id: string;
  domain: Domain;
  title: string;
  memoryHook: string;
  facts: string[];
  confusions: string[];
  sourceUrl: string;
  concepts: string[];
}

export interface AppContent {
  questions: Question[];
  videos: SourceVideo[];
  cheatSheet: CheatSheetEntry[];
}

export interface GroupScore {
  total: number;
  correct: number;
  percentage: number;
  byDomain: Record<Domain, { total: number; correct: number }>;
}
