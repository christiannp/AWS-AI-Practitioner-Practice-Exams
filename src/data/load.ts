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
  const dataUrl = (filename: string) =>
    new URL(`data/${filename}`, document.baseURI).toString();
  const [questions, videos, cheatSheet] = await Promise.all([
    loadJson<Question[]>(dataUrl("questions.json"), "Question bank"),
    loadJson<SourceVideo[]>(dataUrl("source-videos.json"), "Source catalog"),
    loadJson<CheatSheetEntry[]>(dataUrl("cheat-sheet.json"), "Cheat sheet")
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
