import type {
  AppContent,
  CheatSheetEntry,
  Question,
  SourceVideo
} from "./types";

async function loadJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed to load (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function loadContent(): Promise<AppContent> {
  const [questions, videos, cheatSheet] = await Promise.all([
    loadJson<Question[]>("/data/questions.json", "Question bank"),
    loadJson<SourceVideo[]>("/data/source-videos.json", "Source catalog"),
    loadJson<CheatSheetEntry[]>("/data/cheat-sheet.json", "Cheat sheet")
  ]);

  if (
    !Array.isArray(questions) ||
    questions.length === 0 ||
    !Array.isArray(videos) ||
    !Array.isArray(cheatSheet)
  ) {
    throw new Error("Study content has an invalid top-level structure.");
  }

  return { questions, videos, cheatSheet };
}
