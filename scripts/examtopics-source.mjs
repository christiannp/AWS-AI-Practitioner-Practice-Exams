import { createHash } from "node:crypto";
import { load } from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examTopicsBaseUrl =
  "https://www.examtopics.com/exams/amazon/aws-certified-ai-practitioner-aif-c01/view/";
const examTopicsPageCount = 46;
const expectedItemCount = 452;
const browserHeaders = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

function normalizeSourcePrompt(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourcePromptHash(prompt) {
  return createHash("sha256")
    .update(normalizeSourcePrompt(prompt))
    .digest("hex");
}

export function extractExamTopicsPage(html, pageNumber, pageUrl) {
  const $ = load(html);
  return $(".exam-question-card")
    .toArray()
    .map((card) => {
      const root = $(card);
      const questionNumber = Number(
        root.find(".card-header").text().match(/Question\s+#(\d+)/i)?.[1]
      );
      const prompt = root.find(".question-body > .card-text").text().trim();
      const choices = root.find(".multi-choice-item").toArray().map((item) => {
        const text = $(item).clone().children().remove().end().text().trim();
        const match = text.match(/^([A-Z]+)\.\s*(.+)$/s);
        return { code: match?.[1] ?? "", text: match?.[2]?.trim() ?? text };
      });
      const sourceAnswerCodes = root
        .find(".correct-answer")
        .text()
        .split(/[\s,]+/)
        .filter(Boolean);
      const voteText = root.find(".voted-answers-tally").text().trim();
      const communityVotes = voteText ? JSON.parse(voteText) : [];

      return {
        sourceKey: `examtopics:aif-c01:${questionNumber}`,
        pageNumber,
        questionNumber,
        sourceUrl: `${pageUrl}#question-${questionNumber}`,
        prompt,
        choices,
        sourceAnswerCodes,
        communityVotes,
        sourcePromptHash: sourcePromptHash(prompt)
      };
    });
}

function pageUrl(pageNumber) {
  return pageNumber === 1
    ? examTopicsBaseUrl
    : `${examTopicsBaseUrl}${pageNumber}/`;
}

function cachePath(root, pageNumber) {
  return path.join(root, ".source-cache", "examtopics", "pages", `${pageNumber}.html`);
}

async function readCachedPage(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function validateCorpus(items) {
  if (items.length !== expectedItemCount) {
    throw new Error(
      `Expected ${expectedItemCount} ExamTopics items, recovered ${items.length}.`
    );
  }

  const numbers = new Set();
  for (const item of items) {
    if (numbers.has(item.questionNumber)) {
      throw new Error(`Duplicate ExamTopics question number: ${item.questionNumber}.`);
    }
    numbers.add(item.questionNumber);
  }

  for (let number = 1; number <= expectedItemCount; number += 1) {
    if (!numbers.has(number)) {
      throw new Error(`Missing ExamTopics question number: ${number}.`);
    }
  }
}

export async function fetchExamTopicsCorpus(options = {}) {
  const root = options.root ?? fileURLToPath(new URL("..", import.meta.url));
  const request = options.fetch ?? globalThis.fetch;
  const refresh = options.refresh ?? false;
  const pagesDirectory = path.join(root, ".source-cache", "examtopics", "pages");
  const itemsPath = path.join(root, ".source-cache", "examtopics", "items.json");

  if (typeof request !== "function") {
    throw new Error("A fetch implementation is required to recover ExamTopics pages.");
  }

  await mkdir(pagesDirectory, { recursive: true });
  const recovered = [];

  for (let pageNumber = 1; pageNumber <= examTopicsPageCount; pageNumber += 1) {
    const url = pageUrl(pageNumber);
    const filePath = cachePath(root, pageNumber);
    let html = refresh ? null : await readCachedPage(filePath);

    if (html === null) {
      const response = await request(url, { headers: browserHeaders });
      if (!response.ok) {
        throw new Error(`ExamTopics request failed for page ${pageNumber}: ${response.status}.`);
      }
      html = await response.text();
      await writeFile(filePath, html);
    }

    recovered.push(...extractExamTopicsPage(html, pageNumber, url));
  }

  validateCorpus(recovered);
  await writeFile(itemsPath, `${JSON.stringify(recovered, null, 2)}\n`);
  console.log(
    `Recovered ${expectedItemCount} ExamTopics items across ${examTopicsPageCount} pages.`
  );
  return recovered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await fetchExamTopicsCorpus({ refresh: process.argv.includes("--refresh") });
}
