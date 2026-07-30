import type {
  AppContent,
  LearnerState,
  PracticeExam,
  Question
} from "../data/types";

export type Route =
  | "exams"
  | "practice"
  | "results"
  | "cheatsheet"
  | "library";

export interface LibraryFilters {
  status: string;
  domain: string;
  type: string;
  source: string;
  search: string;
}

export interface AppContext {
  content: AppContent;
  getState(): LearnerState;
  today: string;
  libraryFilters: LibraryFilters;
  libraryVisible: number;
  cheatDomain: string;
  questionById(id: string): Question | undefined;
  examById(id: number): PracticeExam | undefined;
}
