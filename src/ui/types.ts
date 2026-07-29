import type {
  AppContent,
  LearnerState,
  Question
} from "../data/types";

export type Route =
  | "home"
  | "practice"
  | "results"
  | "library"
  | "cheatsheet"
  | "settings";

export interface LibraryFilters {
  domain: string;
  type: string;
  attempt: string;
  source: string;
}

export interface AppContext {
  content: AppContent;
  getState(): LearnerState;
  today: string;
  now: Date;
  recoveryPayload?: string;
  libraryFilters: LibraryFilters;
  cheatDomain: string;
  questionById(id: string): Question | undefined;
}
