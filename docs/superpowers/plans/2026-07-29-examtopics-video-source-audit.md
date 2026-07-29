# ExamTopics and Full-Course Source Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit all 452 ExamTopics AIF-C01 items, use the supplied full course to identify current coverage gaps, add only verified original questions and memory notes, and publish the resulting mobile app to the user's public GitHub repository.

**Architecture:** Extend the existing static-data pipeline with a cached ExamTopics extractor, a tracked item-by-item decision ledger, mixed-source provenance, and a chapter-level informational-source manifest. Keep raw third-party wording only in the ignored source cache; generate public audit summaries, original practice questions, corrections, and app filters from deterministic tracked inputs.

**Tech Stack:** Node.js ESM scripts, Cheerio 1.1.2 for offline HTML parsing, TypeScript 5.9, Vite 7, Vitest 3, jsdom, JSON static assets, vanilla HTML/CSS/TypeScript

## Global Constraints

- English only.
- Keep the application mobile-first, static, device-local, untimed, and suitable for the learner's VPS.
- Preserve the editable target date default of `2026-08-31`.
- Preserve adaptive 25-question groups and untimed 65-question mocks.
- Hide all answers and explanations until the entire group is submitted.
- Support only the four current official formats: `multiple-choice`, `multiple-response`, `ordering`, and `matching`.
- Retain all 680 existing YouTube audit records.
- Add exactly 452 ExamTopics audit records, numbered 1 through 452 once each.
- Treat ExamTopics answers, community votes, and video claims as unverified until checked against current authoritative material.
- Prefer the current AWS exam guide, revisions, in-scope list, and official AWS product documentation.
- Never commit or ship raw ExamTopics prompts; cache them only under ignored `.source-cache/`.
- Never ship a practice prompt whose normalized source hash matches the recovered source prompt.
- Preserve all provenance when semantic duplicates map to one original bank question.
- Log every confirmed source-answer error in `source-answer-corrections.txt`.
- Do not impose a target question-bank size; add only materially distinct verified gaps.
- Keep the current official exam logistics: 65 questions, 90 minutes, and no case-study interaction type.

---

## File Structure

```text
.
├── package.json
├── package-lock.json
├── README.md
├── source-answer-corrections.txt
├── public/data/
│   ├── questions.json
│   ├── source-audit.json
│   ├── source-materials.json
│   ├── source-videos.json
│   └── cheat-sheet.json
├── scripts/
│   ├── examtopics-source.mjs
│   ├── examtopics-source.d.mts
│   ├── examtopics-decisions.mjs
│   ├── source-audit.mjs
│   ├── source-audit.d.mts
│   ├── build-examtopics-audit.mjs
│   ├── build-question-bank.mjs
│   ├── question-catalog.mjs
│   └── validate-content.mjs
├── src/
│   ├── data/types.ts
│   ├── data/load.ts
│   ├── data/source.ts
│   ├── domain/selector.ts
│   └── ui/library.ts
└── tests/
    ├── fixtures/examtopics-page.html
    ├── examtopics-source.test.ts
    ├── source-audit.test.ts
    ├── content.test.ts
    ├── selector.test.ts
    └── app.test.ts
```

`examtopics-source.mjs` owns HTTP retrieval, caching, and raw page parsing.
`examtopics-decisions.mjs` is the tracked, item-by-item human review ledger and
contains no source prompt text. `source-audit.mjs` owns mixed-source audit
contracts and validation helpers. `build-examtopics-audit.mjs` joins recovered
cache data with tracked decisions and produces the public mixed manifest.

---

### Task 1: Mixed-Source Contracts and Audit Semantics

**Files:**
- Create: `scripts/source-audit.mjs`
- Create: `scripts/source-audit.d.mts`
- Create: `tests/source-audit.test.ts`
- Modify: `src/data/types.ts`
- Modify: `tests/fixtures/questions.json`
- Modify: `tests/app.test.ts`

**Interfaces:**
- Produces: `AuditDisposition`, `MappedDisposition`, `isMappedDisposition(disposition)`, `sourceFilterKey(source)`, `YouTubeSourceRef`, `ExamTopicsSourceRef`, and the `SourceRef` union.
- Consumes: Existing `Question`, `SourceVideo`, and `AppContent` contracts.

- [ ] **Step 1: Write failing mixed-source contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  isMappedDisposition,
  sourceFilterKey
} from "../scripts/source-audit.mjs";

describe("mixed source audit contracts", () => {
  it("requires mapped dispositions to point to a bank question", () => {
    expect(isMappedDisposition("represented")).toBe(true);
    expect(isMappedDisposition("new-rewrite")).toBe(true);
    expect(isMappedDisposition("semantic-duplicate")).toBe(true);
    expect(isMappedDisposition("incorrect-source-answer")).toBe(true);
    expect(isMappedDisposition("outdated")).toBe(false);
    expect(isMappedDisposition("ambiguous")).toBe(false);
    expect(isMappedDisposition("out-of-scope")).toBe(false);
  });

  it("builds stable filter values for both provenance types", () => {
    expect(
      sourceFilterKey({
        sourceType: "youtube",
        playlistId: "p",
        videoId: "video-1",
        videoTitle: "Video",
        url: "https://www.youtube.com/watch?v=video-1"
      })
    ).toBe("youtube:video-1");
    expect(
      sourceFilterKey({
        sourceType: "examtopics",
        sourceKey: "examtopics:aif-c01:7",
        sourceLabel: "ExamTopics AIF-C01",
        url: "https://www.examtopics.com/example",
        pageNumber: 1,
        questionNumber: 7
      })
    ).toBe("examtopics:aif-c01");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
npm test -- --run tests/source-audit.test.ts
```

Expected: FAIL because `scripts/source-audit.mjs` does not exist.

- [ ] **Step 3: Add the runtime helpers and declaration file**

```js
export const auditDispositions = [
  "represented",
  "new-rewrite",
  "semantic-duplicate",
  "outdated",
  "ambiguous",
  "out-of-scope",
  "incorrect-source-answer"
];

const mappedDispositions = new Set([
  "represented",
  "new-rewrite",
  "semantic-duplicate",
  "incorrect-source-answer"
]);

export function isMappedDisposition(disposition) {
  return mappedDispositions.has(disposition);
}

export function sourceFilterKey(source) {
  return source.sourceType === "examtopics"
    ? "examtopics:aif-c01"
    : `youtube:${source.videoId}`;
}
```

Declare exact argument and return types in `scripts/source-audit.d.mts`, including
the seven-literal `AuditDisposition` union.

- [ ] **Step 4: Replace the single video provenance interface with a discriminated union**

```ts
export interface YouTubeSourceRef {
  sourceType: "youtube";
  playlistId: string;
  videoId: string;
  videoTitle: string;
  url: string;
  questionNumber?: number;
  timestampSeconds?: number;
}

export interface ExamTopicsSourceRef {
  sourceType: "examtopics";
  sourceKey: string;
  sourceLabel: "ExamTopics AIF-C01";
  url: string;
  pageNumber: number;
  questionNumber: number;
}

export type SourceRef = YouTubeSourceRef | ExamTopicsSourceRef;
```

Add `sourceType: "youtube"` to every source in
`tests/fixtures/questions.json`, and to the fixture source used in
`tests/app.test.ts`.

- [ ] **Step 5: Run contract, app, and type checks**

Run:

```bash
npm test -- --run tests/source-audit.test.ts tests/app.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit the mixed-source contract**

```bash
git add scripts/source-audit.mjs scripts/source-audit.d.mts tests/source-audit.test.ts src/data/types.ts tests/fixtures/questions.json tests/app.test.ts
git commit -m "feat: add mixed source provenance contracts"
```

---

### Task 2: ExamTopics Page Parser and Resumable Cache

**Files:**
- Create: `scripts/examtopics-source.mjs`
- Create: `scripts/examtopics-source.d.mts`
- Create: `tests/fixtures/examtopics-page.html`
- Create: `tests/examtopics-source.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Node.js `fetch`, Cheerio, and ignored `.source-cache/`.
- Produces: `extractExamTopicsPage(html, pageNumber, pageUrl)`,
  `fetchExamTopicsCorpus(options)`, and
  `.source-cache/examtopics/items.json`.

- [ ] **Step 1: Add a synthetic two-card HTML fixture**

Create a fixture with the same structural classes used by the source page but
with invented wording:

```html
<article class="card exam-question-card">
  <div class="card-header">Question #1</div>
  <div class="card-body question-body">
    <p class="card-text">Which managed service identifies labels in images?</p>
    <ul class="question-choices-container">
      <li class="multi-choice-item">A. Amazon Rekognition</li>
      <li class="multi-choice-item">B. Amazon Comprehend</li>
      <li class="multi-choice-item">C. Amazon Polly</li>
      <li class="multi-choice-item">D. Amazon Transcribe</li>
    </ul>
    <div class="voted-answers-tally d-none">[{"voted_answers":"A","vote_count":8,"is_most_voted":true}]</div>
    <p class="question-answer"><span class="correct-answer">A</span></p>
  </div>
</article>
<article class="card exam-question-card">
  <div class="card-header">Question #2</div>
  <div class="card-body question-body">
    <p class="card-text">Which control records AWS API activity?</p>
    <ul class="question-choices-container">
      <li class="multi-choice-item">A. AWS Artifact</li>
      <li class="multi-choice-item">B. AWS CloudTrail</li>
      <li class="multi-choice-item">C. Amazon Macie</li>
      <li class="multi-choice-item">D. AWS Budgets</li>
    </ul>
    <div class="voted-answers-tally d-none">[{"voted_answers":"B","vote_count":5,"is_most_voted":true}]</div>
    <p class="question-answer"><span class="correct-answer">B</span></p>
  </div>
</article>
```

- [ ] **Step 2: Write failing parser and hashing tests**

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractExamTopicsPage } from "../scripts/examtopics-source.mjs";

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
    expect(items[0]!.sourcePromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(items[0]!.prompt).toContain("managed service");
  });
});
```

- [ ] **Step 3: Run the parser test and verify it fails**

Run:

```bash
npm test -- --run tests/examtopics-source.test.ts
```

Expected: FAIL because the parser module does not exist.

- [ ] **Step 4: Install the development-only HTML parser**

Run:

```bash
npm install --save-dev cheerio@1.1.2
```

Expected: `package.json` and `package-lock.json` record Cheerio 1.1.2.

- [ ] **Step 5: Implement deterministic offline parsing**

Implement `extractExamTopicsPage` with Cheerio:

```js
import { createHash } from "node:crypto";
import { load } from "cheerio";

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
```

Export matching declarations from `scripts/examtopics-source.d.mts`.

- [ ] **Step 6: Add resumable 46-page retrieval**

Implement `fetchExamTopicsCorpus` so that it:

- Fetches pages 1–46 using the base page for page 1 and `/view/<page>/` for
  later pages.
- Uses an explicit browser-like user agent and English accept-language header.
- Writes each successful response to
  `.source-cache/examtopics/pages/<page>.html`.
- Reuses a cached page unless `refresh: true`.
- Throws on non-2xx responses, duplicate question numbers, missing numbers, or
  a total other than 452.
- Writes the raw recovered array only to
  `.source-cache/examtopics/items.json`.
- Prints `Recovered 452 ExamTopics items across 46 pages.`

Expose a CLI:

```bash
node scripts/examtopics-source.mjs
node scripts/examtopics-source.mjs --refresh
```

- [ ] **Step 7: Run parser tests and recover the corpus**

Run:

```bash
npm test -- --run tests/examtopics-source.test.ts
node scripts/examtopics-source.mjs
```

Expected: tests pass and the script reports exactly 452 unique items.

- [ ] **Step 8: Commit parser code without committing the cache**

```bash
git status --short
git add package.json package-lock.json scripts/examtopics-source.mjs scripts/examtopics-source.d.mts tests/fixtures/examtopics-page.html tests/examtopics-source.test.ts
git commit -m "feat: recover ExamTopics source items"
```

Expected: `.source-cache/` is absent from `git status`.

---

### Task 3: Tracked Review Ledger and Public Audit Builder

**Files:**
- Create: `scripts/examtopics-decisions.mjs`
- Create: `scripts/build-examtopics-audit.mjs`
- Modify: `scripts/source-audit.mjs`
- Modify: `scripts/source-audit.d.mts`
- Modify: `tests/source-audit.test.ts`
- Modify: `scripts/validate-content.mjs`

**Interfaces:**
- Consumes: `.source-cache/examtopics/items.json`, the existing 680-record
  YouTube audit, `concepts`, and `examTopicsDecisions`.
- Produces: `ExamTopicsDecision`, `buildExamTopicsAudit(items, decisions)`,
  range checks, and a 1,132-record mixed `public/data/source-audit.json`.

- [ ] **Step 1: Write failing decision-contract tests**

```ts
import {
  buildExamTopicsAudit,
  validateDecision
} from "../scripts/build-examtopics-audit.mjs";

it("rejects a mapped decision without a concept and verification", () => {
  expect(() =>
    validateDecision({
      sourceKey: "examtopics:aif-c01:1",
      disposition: "represented",
      reason: "Covered."
    })
  ).toThrow(/conceptKey/);
});

it("builds public records without raw prompt or choice text", () => {
  const [entry] = buildExamTopicsAudit(
    [{
      sourceKey: "examtopics:aif-c01:1",
      pageNumber: 1,
      questionNumber: 1,
      sourceUrl: "https://example.com/q1",
      prompt: "Raw source wording",
      choices: [{ code: "A", text: "Raw option" }],
      sourceAnswerCodes: ["A"],
      communityVotes: [],
      sourcePromptHash: "a".repeat(64)
    }],
    [{
      sourceKey: "examtopics:aif-c01:1",
      disposition: "represented",
      conceptKey: "amazon-rekognition",
      promptSummary: "Tests the managed service for image analysis.",
      verifiedAnswerSummary: "Amazon Rekognition",
      verification: ["https://docs.aws.amazon.com/rekognition/"],
      verifiedOn: "2026-07-29",
      reason: "The official service definition establishes the answer."
    }]
  );
  expect(entry).not.toHaveProperty("prompt");
  expect(entry).not.toHaveProperty("choices");
  expect(entry.sourcePromptHash).toBe("a".repeat(64));
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- --run tests/source-audit.test.ts
```

Expected: FAIL because the decision builder is missing.

- [ ] **Step 3: Define the exact tracked decision shape**

```js
export const examTopicsDecisions = [
  // One object for every source key is added during Tasks 4–8.
];
```

Each final object must use this contract:

```ts
interface ExamTopicsDecision {
  sourceKey: `examtopics:aif-c01:${number}`;
  disposition:
    | "represented"
    | "new-rewrite"
    | "semantic-duplicate"
    | "outdated"
    | "ambiguous"
    | "out-of-scope"
    | "incorrect-source-answer";
  conceptKey?: string;
  promptSummary: string;
  verifiedAnswerSummary?: string;
  verification: string[];
  verifiedOn: "2026-07-29";
  reason: string;
  correctionId?: string;
}
```

The tracked ledger stores no prompt, choice, explanation, or discussion text
from ExamTopics.

- [ ] **Step 4: Implement decision validation and public-record projection**

`validateDecision` must enforce:

- `sourceKey`, disposition, prompt summary, reason, and verification date.
- Mapped dispositions require `conceptKey`, `verifiedAnswerSummary`, and at
  least one HTTPS verification URL.
- Excluded dispositions forbid `conceptKey`.
- `incorrect-source-answer` requires `correctionId`.
- All other dispositions forbid `correctionId`.

`buildExamTopicsAudit` joins by `sourceKey` and emits:

```js
{
  sourceKey: item.sourceKey,
  sourceType: "examtopics",
  sourceLabel: "ExamTopics AIF-C01",
  sourceUrl: item.sourceUrl,
  pageNumber: item.pageNumber,
  questionNumber: item.questionNumber,
  sourcePromptHash: item.sourcePromptHash,
  sourceAnswerCodes: item.sourceAnswerCodes,
  communityVotes: item.communityVotes,
  promptSummary: decision.promptSummary,
  disposition: decision.disposition,
  reason: decision.reason,
  conceptKey: decision.conceptKey,
  verifiedAnswerSummary: decision.verifiedAnswerSummary,
  verification: decision.verification,
  verifiedOn: decision.verifiedOn,
  correctionId: decision.correctionId
}
```

- [ ] **Step 5: Add range-check and final-write CLI modes**

Support:

```bash
node scripts/build-examtopics-audit.mjs --check --from 1 --to 100
node scripts/build-examtopics-audit.mjs --write
```

Range checks fail if any requested number lacks a valid decision. `--write`
requires all 452 decisions, adds `sourceType: "youtube"` and
`disposition` mappings to the existing 680 YouTube records, and writes exactly
1,132 records. Convert legacy YouTube statuses as follows:

```js
const youtubeDisposition = {
  included: "represented",
  merged: "semantic-duplicate",
  corrected: "incorrect-source-answer",
  excluded: "out-of-scope"
};
```

For the existing corrected YouTube item, set
`correctionId: "youtube:yrkju-Ch7ME:9"` during conversion. Other YouTube
records must not receive a correction ID.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
npm test -- --run tests/source-audit.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the ledger framework**

```bash
git add scripts/examtopics-decisions.mjs scripts/build-examtopics-audit.mjs scripts/source-audit.mjs scripts/source-audit.d.mts scripts/validate-content.mjs tests/source-audit.test.ts
git commit -m "feat: add deterministic ExamTopics audit ledger"
```

---

### Task 4: Verify ExamTopics Questions 1–100

**Files:**
- Modify: `scripts/examtopics-decisions.mjs`
- Modify: `source-answer-corrections.txt`

**Interfaces:**
- Consumes: Recovered items 1–100, `concepts`, current official AWS sources,
  and the correction-report contract.
- Produces: 100 valid decisions with no pending item in the range.

- [ ] **Step 1: Run the range check and capture the expected failure**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 1 --to 100
```

Expected: FAIL listing the missing decision keys in the requested range.

- [ ] **Step 2: Review each source item against authoritative evidence**

For every number 1–100:

1. Read its prompt, choices, source answer, and vote metadata from the ignored
   recovered cache.
2. Identify the tested decision and its current AIF-C01 task.
3. Compare it with the existing concept catalog and question fingerprints.
4. Verify the answer against the current exam guide or direct official product
   documentation.
5. Add one fully populated decision object.
6. Use `represented` when the existing scenario already covers the tested
   decision, `semantic-duplicate` for equivalent conditions, and
   `new-rewrite` only for a materially distinct valid gap.
7. Use `incorrect-source-answer` only when authoritative evidence directly
   contradicts the source answer.
8. Record each confirmed error immediately using this exact text contract:

```text
Correction ID: examtopics:aif-c01:<number>
Source: ExamTopics AWS Certified AI Practitioner AIF-C01
Question location: Page <page>, Question <number> — <source URL>
Question summary: <original concise summary>
Source stated: <source answer label and concise answer>
Verified answer: <verified concise answer>
Why: <direct explanation of the discrepancy>
Verification: <official HTTPS URL or semicolon-separated URLs>
Verified on: 2026-07-29
Mapped question: <bank question ID derived from conceptKey>
```

- [ ] **Step 3: Validate the completed range**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 1 --to 100
```

Expected: `Reviewed 100 of 100 requested ExamTopics items.`

- [ ] **Step 4: Commit the first audit batch**

```bash
git add scripts/examtopics-decisions.mjs source-answer-corrections.txt
git commit -m "content: audit ExamTopics questions 1 through 100"
```

---

### Task 5: Verify ExamTopics Questions 101–200

**Files:**
- Modify: `scripts/examtopics-decisions.mjs`
- Modify: `source-answer-corrections.txt`

**Interfaces:**
- Consumes: Recovered items 101–200 and the same current-authority policy.
- Produces: 100 additional final decisions and complete corrections for the
  range.

- [ ] **Step 1: Confirm the second range is incomplete**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 101 --to 200
```

Expected: FAIL with missing keys from 101–200.

- [ ] **Step 2: Audit all 100 items**

For each number 101–200, inspect the cached source item, identify the current
exam task and tested decision, compare it with existing concept fingerprints,
and verify the answer with current official AWS material. Add one ledger object
using the complete `ExamTopicsDecision` contract. Do not use votes as evidence.

For a confirmed wrong source answer, add the complete nine-field correction
entry shown in Task 4 and set the decision's `correctionId` to the identical
`examtopics:aif-c01:<number>` value.

- [ ] **Step 3: Validate the second range**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 101 --to 200
```

Expected: `Reviewed 100 of 100 requested ExamTopics items.`

- [ ] **Step 4: Commit the second audit batch**

```bash
git add scripts/examtopics-decisions.mjs source-answer-corrections.txt
git commit -m "content: audit ExamTopics questions 101 through 200"
```

---

### Task 6: Verify ExamTopics Questions 201–300

**Files:**
- Modify: `scripts/examtopics-decisions.mjs`
- Modify: `source-answer-corrections.txt`

**Interfaces:**
- Consumes: Recovered items 201–300 and current official evidence.
- Produces: 100 additional final decisions and linked corrections.

- [ ] **Step 1: Confirm the third range is incomplete**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 201 --to 300
```

Expected: FAIL with missing keys from 201–300.

- [ ] **Step 2: Audit all 100 items**

For each number 201–300, read the recovered item from the ignored cache,
determine the exact scenario conditions, map or create the tested concept,
verify the answer with the latest directly applicable AWS source, and add one
complete decision. Exclude ambiguous, outdated, and out-of-scope items instead
of forcing a questionable answer.

Every `incorrect-source-answer` decision receives the full correction entry
and matching correction ID. Every mapped non-error decision includes a concise
verified answer and at least one official HTTPS URL.

- [ ] **Step 3: Validate the third range**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 201 --to 300
```

Expected: `Reviewed 100 of 100 requested ExamTopics items.`

- [ ] **Step 4: Commit the third audit batch**

```bash
git add scripts/examtopics-decisions.mjs source-answer-corrections.txt
git commit -m "content: audit ExamTopics questions 201 through 300"
```

---

### Task 7: Verify ExamTopics Questions 301–400

**Files:**
- Modify: `scripts/examtopics-decisions.mjs`
- Modify: `source-answer-corrections.txt`

**Interfaces:**
- Consumes: Recovered items 301–400, existing decisions, and official AWS
  evidence.
- Produces: 100 additional final decisions and linked corrections.

- [ ] **Step 1: Confirm the fourth range is incomplete**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 301 --to 400
```

Expected: FAIL with missing keys from 301–400.

- [ ] **Step 2: Audit all 100 items**

For each number 301–400, verify the source-stated answer independently, compare
the tested decision with all earlier fingerprints, and add one complete ledger
entry. Preserve distinct conditions such as latency, payload size, security
boundary, evaluation objective, or data type; merge only when those conditions
do not change the best answer.

For every confirmed answer error, add the exact correction entry contract and
use the same stable ID in the decision ledger.

- [ ] **Step 3: Validate the fourth range**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 301 --to 400
```

Expected: `Reviewed 100 of 100 requested ExamTopics items.`

- [ ] **Step 4: Commit the fourth audit batch**

```bash
git add scripts/examtopics-decisions.mjs source-answer-corrections.txt
git commit -m "content: audit ExamTopics questions 301 through 400"
```

---

### Task 8: Verify ExamTopics Questions 401–452 and Build the Mixed Manifest

**Files:**
- Modify: `scripts/examtopics-decisions.mjs`
- Modify: `source-answer-corrections.txt`
- Modify: `public/data/source-audit.json`

**Interfaces:**
- Consumes: Recovered items 401–452 and all 400 earlier decisions.
- Produces: 452 valid ExamTopics decisions and the complete 1,132-record public
  mixed-source manifest.

- [ ] **Step 1: Confirm the final range is incomplete**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 401 --to 452
```

Expected: FAIL with missing keys from 401–452.

- [ ] **Step 2: Audit the final 52 items**

For each number 401–452, verify the tested decision and answer with current
official evidence, compare it with every existing concept and fingerprint, and
write one complete decision. Exclude any item whose ambiguity cannot be removed
without inventing conditions. Add the full correction entry for every
confirmed source-answer error.

- [ ] **Step 3: Validate all ranges and write the mixed audit**

Run:

```bash
node scripts/build-examtopics-audit.mjs --check --from 1 --to 452
node scripts/build-examtopics-audit.mjs --write
```

Expected:

```text
Reviewed 452 of 452 requested ExamTopics items.
Wrote 1132 mixed source records: 680 YouTube, 452 ExamTopics.
```

- [ ] **Step 4: Run source-audit tests**

Run:

```bash
npm test -- --run tests/source-audit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the final audit batch and generated manifest**

```bash
git add scripts/examtopics-decisions.mjs source-answer-corrections.txt public/data/source-audit.json
git commit -m "content: complete 452-item ExamTopics audit"
```

---

### Task 9: Mixed Provenance and Verified Gap Questions

**Files:**
- Modify: `scripts/build-question-bank.mjs`
- Modify: `scripts/question-catalog.mjs`
- Modify: `public/data/questions.json`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Consumes: Mixed source audit, `ExamTopicsDecision.conceptKey`, and the
  existing concept-driven question generator.
- Produces: Original questions with mixed provenance and a mapped question ID
  for every included audit record.

- [ ] **Step 1: Write failing mixed-provenance content tests**

```ts
it("maps every represented source item back to a shipped question", () => {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  expect(
    audit
      .filter((entry) => isMappedDisposition(entry.disposition))
      .every((entry) => {
        const question = questionById.get(entry.questionId);
        return question?.sources.some((source) =>
          source.sourceType === "examtopics"
            ? source.sourceKey === entry.sourceKey
            : `${source.videoId}:${source.questionNumber}` === entry.sourceKey
        );
      })
  ).toBe(true);
});

it("ships no prompt whose normalized hash matches its ExamTopics source", () => {
  const hashByKey = new Map(
    audit
      .filter((entry) => entry.sourceType === "examtopics")
      .map((entry) => [entry.sourceKey, entry.sourcePromptHash])
  );
  expect(
    questions.every((question) =>
      question.sources
        .filter((source) => source.sourceType === "examtopics")
        .every((source) => hashNormalizedPrompt(question.prompt) !== hashByKey.get(source.sourceKey))
    )
  ).toBe(true);
});
```

Export `hashNormalizedPrompt` from the normalization module so production
validation and tests share the same hashing rule.

- [ ] **Step 2: Run the tests and verify the provenance failure**

Run:

```bash
npm test -- --run tests/content.test.ts
```

Expected: FAIL because the current generator assumes every source is YouTube.

- [ ] **Step 3: Make source projection discriminated**

```js
function sourceRef(entry) {
  if (entry.sourceType === "examtopics") {
    return {
      sourceType: "examtopics",
      sourceKey: entry.sourceKey,
      sourceLabel: "ExamTopics AIF-C01",
      url: entry.sourceUrl,
      pageNumber: entry.pageNumber,
      questionNumber: entry.questionNumber
    };
  }
  return {
    sourceType: "youtube",
    playlistId: entry.playlistId,
    videoId: entry.videoId,
    videoTitle: entry.videoTitle,
    url: entry.sourceUrl,
    questionNumber: entry.questionNumber,
    timestampSeconds: entry.timestampSeconds
  };
}
```

Group mapped audit entries by `conceptKey`; do not rematch reviewed ExamTopics
items by keywords. Keep the existing YouTube mapping behavior.

- [ ] **Step 4: Add every verified `new-rewrite` concept**

For each `new-rewrite` decision, add one `concept(...)` entry whose key exactly
matches the decision ledger, whose task is a current AIF-C01 task, and whose
verification URL is the direct authoritative source used during review.

Add this guaranteed course-gap concept:

```js
concept(
  "aws-lake-formation",
  5,
  "5.1",
  "AWS Lake Formation",
  "centrally govern fine-grained access to data in an Amazon S3 data lake",
  "Builds on the AWS Glue Data Catalog and provides database-, table-, column-, row-, and cell-level permissions for governed data lake access.",
  ["data lake permissions", "fine-grained access", "glue data catalog"],
  "https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html"
)
```

Do not add a concept when the decision is `represented`,
`semantic-duplicate`, `outdated`, `ambiguous`, or `out-of-scope`.

- [ ] **Step 5: Regenerate the bank and audit mappings**

Run:

```bash
node scripts/build-question-bank.mjs
```

Expected: every mapped record has `questionId`, every new prompt is original,
and generated questions retain all matching YouTube and ExamTopics sources.

- [ ] **Step 6: Run focused content checks**

Run:

```bash
npm test -- --run tests/content.test.ts
node scripts/validate-content.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the verified bank expansion**

```bash
git add scripts/build-question-bank.mjs scripts/question-catalog.mjs scripts/normalize-question.mjs scripts/normalize-question.d.mts public/data/questions.json public/data/source-audit.json tests/content.test.ts
git commit -m "content: add verified gaps with mixed provenance"
```

---

### Task 10: Full-Course Coverage Manifest and Memory Notes

**Files:**
- Create: `public/data/source-materials.json`
- Modify: `public/data/cheat-sheet.json`
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Consumes: The freeCodeCamp/ExamPro chapter list, current AIF-C01 guide, the
  mixed bank, and the current in-scope list.
- Produces: One informational material with 16 chapter records and gap-backed
  cheat-sheet updates.

- [ ] **Step 1: Write failing course-manifest tests**

```ts
import materials from "../public/data/source-materials.json";

it("classifies every chapter of the supplied full course", () => {
  const course = materials.find(
    (item) => item.id === "youtube:WZeZZ8_W-M4"
  );
  expect(course?.durationSeconds).toBe(53928);
  expect(course?.chapters).toHaveLength(16);
  expect(
    course?.chapters.every((chapter) =>
      ["covered", "gap", "out-of-scope", "outdated"].includes(chapter.coverage)
    )
  ).toBe(true);
});

it("does not accept beta-era logistics as current", () => {
  const course = materials.find(
    (item) => item.id === "youtube:WZeZZ8_W-M4"
  );
  expect(course?.rejectedClaims).toContainEqual(
    expect.objectContaining({
      claim: "The exam duration is 120 minutes.",
      currentRule: "The current exam duration is 90 minutes."
    })
  );
});
```

- [ ] **Step 2: Run the test and confirm the missing-file failure**

Run:

```bash
npm test -- --run tests/content.test.ts
```

Expected: FAIL because `source-materials.json` does not exist.

- [ ] **Step 3: Add the informational material and all chapter timestamps**

Create the course record with these 16 chapter starts:

```json
[
  ["Introduction", 0],
  ["AI and ML Fundamentals", 1068],
  ["Data", 4607],
  ["Gen AI Primer", 5508],
  ["Amazon Bedrock", 7342],
  ["Datastores for GenAI", 26160],
  ["PartyRock", 28338],
  ["Amazon SageMaker AI", 29326],
  ["Evaluations", 34904],
  ["AI Developer Tools", 36398],
  ["AWS Managed ML", 37814],
  ["Generative AI Security", 47970],
  ["Amazon Athena", 48918],
  ["AWS Glue", 49875],
  ["Amazon OpenSearch Service", 52386],
  ["AWS Lake Formation", 53772]
]
```

Each chapter includes `domains`, `tasks`, `concepts`, `coverage`, `reason`, and
at least one current verification URL. Mark PartyRock and Athena
`out-of-scope`; mark beta exam logistics under `rejectedClaims`; mark Lake
Formation `gap` until the concept and memory note are present.

- [ ] **Step 4: Add a concise data-governance memory card**

```json
{
  "id": "d5-data-governance-services",
  "domain": 5,
  "title": "Data discovery versus governance",
  "memoryHook": "Glue catalogs; Lake Formation governs; Macie discovers sensitive S3 data.",
  "facts": [
    "AWS Glue Data Catalog stores technical metadata about data assets.",
    "AWS Lake Formation applies fine-grained permissions to governed data lake resources.",
    "Amazon Macie discovers and reports sensitive data in Amazon S3."
  ],
  "confusions": [
    "A catalog describes data; Lake Formation controls governed access; Macie detects sensitive content."
  ],
  "sourceUrl": "https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html",
  "concepts": ["aws-glue", "aws-lake-formation", "amazon-macie"]
}
```

- [ ] **Step 5: Validate chapter and memory-note contracts**

Extend `validate-content.mjs` to require:

- One `youtube:WZeZZ8_W-M4` informational material.
- Exactly 16 unique, increasing chapter timestamps.
- A valid coverage value, non-empty reason, and HTTPS verification per chapter.
- Both rejected beta claims: 120-minute duration and case-study format.
- A cheat-sheet concept for every material chapter marked `gap`.

- [ ] **Step 6: Run focused validation**

Run:

```bash
npm test -- --run tests/content.test.ts
node scripts/validate-content.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the course audit**

```bash
git add public/data/source-materials.json public/data/cheat-sheet.json scripts/validate-content.mjs tests/content.test.ts
git commit -m "content: audit full course and add governance memory note"
```

---

### Task 11: ExamTopics Library Filter and Source Practice

**Files:**
- Create: `src/data/source.ts`
- Modify: `src/domain/selector.ts`
- Modify: `src/ui/library.ts`
- Modify: `src/main.ts`
- Modify: `tests/selector.test.ts`
- Modify: `tests/app.test.ts`

**Interfaces:**
- Consumes: `sourceFilterKey(source)` and mixed `SourceRef`.
- Produces: `selectSourceGroup(bank, filterKey)` for `youtube:<videoId>` and
  `examtopics:aif-c01`.

- [ ] **Step 1: Write failing selector and mobile-flow tests**

```ts
it("selects the consolidated ExamTopics source without duplicates", () => {
  const selected = selectSourceGroup(bank, "examtopics:aif-c01");
  expect(selected.length).toBeGreaterThan(0);
  expect(new Set(selected.map((question) => question.id)).size).toBe(
    selected.length
  );
  expect(
    selected.every((question) =>
      question.sources.some(
        (source) => source.sourceType === "examtopics"
      )
    )
  ).toBe(true);
});
```

In `tests/app.test.ts`, add an ExamTopics source to one fixture question,
navigate to Library, choose `examtopics:aif-c01`, click **Start source**, and
assert that the saved in-progress group contains that question once.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
npm test -- --run tests/selector.test.ts tests/app.test.ts
```

Expected: FAIL because selection still compares only `videoId`.

- [ ] **Step 3: Update source selection**

```ts
export function selectSourceGroup(
  bank: Question[],
  filterKey: string
): Question[] {
  return uniqueBank(
    bank.filter((question) =>
      question.sources.some(
        (source) => sourceFilterKey(source) === filterKey
      )
    )
  );
}
```

Place the browser-safe equivalent of `sourceFilterKey` in the TypeScript
module `src/data/source.ts`:

```ts
import type { SourceRef } from "./types";

export function sourceFilterKey(source: SourceRef): string {
  return source.sourceType === "examtopics"
    ? "examtopics:aif-c01"
    : `youtube:${source.videoId}`;
}
```

Import this function into `selector.ts` and `library.ts`; do not import a Node
script into the browser bundle.

- [ ] **Step 4: Replace the video-only selector with a source selector**

Use values `youtube:<videoId>` for video options and add:

```html
<option value="examtopics:aif-c01">ExamTopics AIF-C01 · consolidated</option>
```

Render that option only when at least one bank question has ExamTopics
provenance. Change the label from **Video source** to **Question source** and
the empty option from **All videos** to **All sources**.

- [ ] **Step 5: Run selector and app tests**

Run:

```bash
npm test -- --run tests/selector.test.ts tests/app.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit the source practice UI**

```bash
git add src/domain/selector.ts src/ui/library.ts src/main.ts src/data/source.ts tests/selector.test.ts tests/app.test.ts
git commit -m "feat: add ExamTopics source practice filter"
```

---

### Task 12: Final Content Validation, Documentation, and Production Check

**Files:**
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/content.test.ts`
- Modify: `source-answer-corrections.txt`
- Modify: `README.md`

**Interfaces:**
- Consumes: The final mixed audit, question bank, correction report, course
  manifest, cheat sheet, and all application tests.
- Produces: One strict `npm run check` gate and an updated VPS/GitHub handoff.

- [ ] **Step 1: Add final acceptance assertions**

Add tests that require:

```ts
expect(audit).toHaveLength(1132);
expect(audit.filter((entry) => entry.sourceType === "youtube")).toHaveLength(680);
expect(audit.filter((entry) => entry.sourceType === "examtopics")).toHaveLength(452);
expect(
  audit
    .filter((entry) => entry.sourceType === "examtopics")
    .map((entry) => entry.questionNumber)
    .sort((a, b) => a - b)
).toEqual(Array.from({ length: 452 }, (_, index) => index + 1));
expect(audit.some((entry) => entry.disposition === "pending")).toBe(false);
```

Parse correction IDs from `source-answer-corrections.txt` and assert exact
two-way linkage with all `incorrect-source-answer` audit records.

- [ ] **Step 2: Run the content tests and confirm any remaining contract failures**

Run:

```bash
npm test -- --run tests/content.test.ts
```

Expected: FAIL only for final validator or report fields not yet aligned.

- [ ] **Step 3: Finish strict production validation**

Make `validate-content.mjs` enforce:

- Exactly 1,132 source records with exact source-type counts.
- ExamTopics numbers 1–452 exactly once.
- Valid source URLs, prompt summaries no longer than 180 characters, reasons,
  dispositions, verification dates, and source hashes.
- Mapped/excluded question ID rules.
- Correction ID two-way linkage.
- Mixed provenance references on every mapped question.
- Original prompt hashes distinct from source hashes.
- Unique IDs, normalized prompts, and concept fingerprints.
- Four interaction formats only.
- Course manifest and cheat-sheet coverage.

Update the existing YouTube correction entry with:

```text
Correction ID: youtube:yrkju-Ch7ME:9
Mapped question: aif-d5-sse-s3-object-access-scenario
```

Keep the existing source, location, summary, stated answer, verified answer,
reason, verification URLs, and date unchanged.

- [ ] **Step 4: Update the README handoff**

Document:

- The 452-item ExamTopics audit and 680-item YouTube audit.
- The final generated question count.
- The full-course chapter audit and why beta-era logistics were rejected.
- ExamTopics as a coverage source, not an answer authority.
- The source filter and complete correction report.
- The unchanged local-only/VPS deployment model.

- [ ] **Step 5: Run the complete quality gate**

Run:

```bash
npm run check
git diff --check
git status --short
```

Expected:

- Content validation reports the final question count, 1,132 source records,
  and the final memory-note count.
- All Vitest files pass.
- Type checking and Vite production build pass.
- `git diff --check` prints nothing.
- Only intended tracked files are modified.

- [ ] **Step 6: Commit the verified update**

```bash
git add README.md source-answer-corrections.txt public/data scripts src tests package.json package-lock.json
git commit -m "feat: complete expanded AIF-C01 source audit"
```

---

### Task 13: Publish the Reviewed Branch to the Public GitHub Repository

Execute this release-only task after Tasks 1–12 pass the broad SDD
whole-branch review and any final-review fixes are complete. It intentionally
runs after that review because the user approved review-first publication.

**Files:**
- No source-file changes expected.

**Interfaces:**
- Consumes: A clean verified branch and the already-created public repository
  `christiannp/AWS-AI-Practitioner-Practice-Exams`.
- Produces: Public `main` branch containing the complete Git history and final
  verified source.

- [ ] **Step 1: Re-run verification on the exact committed state**

Run:

```bash
npm run check
git status --short
git log -1 --oneline
```

Expected: all checks pass and the worktree is clean.

- [ ] **Step 2: Confirm GitHub authentication and repository visibility**

Run:

```bash
gh auth status
gh repo view christiannp/AWS-AI-Practitioner-Practice-Exams --json nameWithOwner,visibility,url
```

Expected: authenticated as `christiannp`, repository visibility `PUBLIC`, and
URL `https://github.com/christiannp/AWS-AI-Practitioner-Practice-Exams`.

If `gh auth status` is not authenticated, use the GitHub skill's supported
interactive authorization flow in the signed-in browser, then repeat both
commands. Do not print or persist credentials.

- [ ] **Step 3: Add or verify the exact remote**

Run:

```bash
git remote get-url origin
```

If `origin` is absent:

```bash
git remote add origin https://github.com/christiannp/AWS-AI-Practitioner-Practice-Exams.git
```

If it exists, require the exact same URL before proceeding.

- [ ] **Step 4: Push the implementation branch as public main**

Run:

```bash
git push --set-upstream origin agent/aws-ai-practitioner-app:main
```

Expected: GitHub reports the new `main` branch and complete history.

- [ ] **Step 5: Verify the published commit and key files**

Run:

```bash
git ls-remote origin refs/heads/main
gh api repos/christiannp/AWS-AI-Practitioner-Practice-Exams/contents/public/data/source-audit.json --jq '.size'
gh api repos/christiannp/AWS-AI-Practitioner-Practice-Exams/contents/README.md --jq '.html_url'
```

Expected: `main` resolves to the local HEAD, the mixed audit exists and is
non-empty, and the README URL is returned.
