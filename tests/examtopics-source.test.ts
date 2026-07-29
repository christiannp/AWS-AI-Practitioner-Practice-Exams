import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractExamTopicsPage,
  fetchExamTopicsCorpus
} from "../scripts/examtopics-source.mjs";

const html = readFileSync(
  fileURLToPath(new URL("./fixtures/examtopics-page.html", import.meta.url)),
  "utf8"
);

describe("ExamTopics recovery", () => {
  it("extracts location, answer codes, choices, votes, and a source hash", () => {
    const items = extractExamTopicsPage(
      html,
      1,
      "https://www.examtopics.com/exams/amazon/aws-certified-ai-practitioner-aif-c01/view/"
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceKey: "examtopics:aif-c01:1",
      pageNumber: 1,
      questionNumber: 1,
      sourceAnswerCodes: ["A"],
      choices: [
        { code: "A", text: "Amazon Rekognition" },
        { code: "B", text: "Amazon Comprehend" },
        { code: "C", text: "Amazon Polly" },
        { code: "D", text: "Amazon Transcribe" }
      ]
    });
    expect(items[0]!.communityVotes).toEqual([
      { voted_answers: "A", vote_count: 8, is_most_voted: true }
    ]);
    expect(items[0]!.sourcePromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(items[0]!.prompt).toContain("managed service");
  });

  it("retrieves and reuses a complete 46-page cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "examtopics-source-"));
    const requested = [] as Array<{ url: string; headers: Headers }>;
    const baseUrl =
      "https://www.examtopics.com/exams/amazon/aws-certified-ai-practitioner-aif-c01/view/";
    const itemHtml = (questionNumber: number) => `
      <article class="card exam-question-card">
        <div class="card-header">Question #${questionNumber}</div>
        <div class="card-body question-body">
          <p class="card-text">Synthetic prompt ${questionNumber}</p>
          <ul class="question-choices-container">
            <li class="multi-choice-item">A. Choice A</li>
          </ul>
          <div class="voted-answers-tally d-none">[]</div>
          <p class="question-answer"><span class="correct-answer">A</span></p>
        </div>
      </article>`;
    const fakeFetch = async (url: string, init: RequestInit) => {
      requested.push({ url, headers: new Headers(init.headers) });
      const page = url === baseUrl ? 1 : Number(url.match(/view\/(\d+)\/$/)?.[1]);
      const firstQuestion = (page - 1) * 10 + 1;
      const count = page === 46 ? 2 : 10;
      return new Response(
        Array.from({ length: count }, (_, index) => itemHtml(firstQuestion + index)).join(""),
        { status: 200 }
      );
    };

    try {
      const recovered = await fetchExamTopicsCorpus({ root, fetch: fakeFetch });
      expect(recovered).toHaveLength(452);
      expect(requested).toHaveLength(46);
      expect(requested[0]!.url).toBe(baseUrl);
      expect(requested[45]!.url).toBe(`${baseUrl}46/`);
      expect(requested[0]!.headers.get("accept-language")).toContain("en");
      await expect(
        readFile(join(root, ".source-cache/examtopics/pages/1.html"), "utf8")
      ).resolves.toContain("Synthetic prompt 1");
      await expect(
        readFile(join(root, ".source-cache/examtopics/items.json"), "utf8")
      ).resolves.toContain('"questionNumber": 452');

      const cached = await fetchExamTopicsCorpus({
        root,
        fetch: async () => {
          throw new Error("cache was not reused");
        }
      });
      expect(cached).toHaveLength(452);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
