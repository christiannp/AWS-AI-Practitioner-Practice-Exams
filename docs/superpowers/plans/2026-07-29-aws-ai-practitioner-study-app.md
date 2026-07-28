# AWS AI Practitioner Study App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first static study app that converts both supplied YouTube playlists into a verified, deduplicated AIF-C01 question bank and serves adaptive 25-question daily practice, untimed mocks, progress tracking, and a memorization cheat sheet.

**Architecture:** Use a vanilla TypeScript/Vite client with hash-based views and no backend. Keep question data, source audit, and cheat-sheet content as validated static assets; keep only learner state in versioned `localStorage`. Put selection, scoring, mastery, persistence, and UI rendering behind focused modules so each can be tested independently.

**Tech Stack:** HTML5, CSS, TypeScript, Vite, Vitest, jsdom, Node.js content scripts, JSON static assets

## Global Constraints

- English only.
- Mobile-first static output suitable for the learner's VPS.
- No account, credentials, backend, telemetry, remote persistence, or timer.
- The editable target date defaults to `2026-08-31`.
- A normal daily group contains exactly 25 distinct questions.
- Answers and explanations remain hidden until the whole group is submitted.
- Support `multiple-choice`, `multiple-response`, `ordering`, and `matching`.
- Include every discernible source question from both playlists, subject to deduplication and quality correction.
- Preserve all source references when duplicate source questions are consolidated.
- Every shipped answer needs a current authoritative verification URL and verification date.
- Official AWS sources take priority over videos and secondary sources.
- Persist settings, attempts, mastery, history, and in-progress work on the device.
- Provide JSON backup, restore, and confirmed reset.
- Include untimed 65-question mixed mocks, source groups, and a downloadable cheat sheet.
- `source-answer-corrections.txt` logs confirmed source-material errors only.

---

## File Structure

```text
.
├── index.html                         # Static application shell and metadata
├── package.json                       # Development, test, validation, and build scripts
├── tsconfig.json                      # Strict TypeScript configuration
├── vite.config.ts                     # Static Vite build
├── README.md                          # Local use, testing, and VPS deployment
├── source-answer-corrections.txt      # Confirmed source-answer errors
├── public/
│   ├── data/
│   │   ├── questions.json             # Verified deduplicated question bank
│   │   ├── source-audit.json          # Every recovered source question and disposition
│   │   ├── source-videos.json         # Playlist/video catalog and question ranges
│   │   └── cheat-sheet.json           # Domain-based memory notes
├── scripts/
│   ├── youtube-source.mjs             # Playlist metadata and caption retrieval
│   ├── build-source-audit.mjs         # Caption segmentation and source-question manifest
│   ├── normalize-question.mjs         # Exact normalization and concept fingerprinting
│   └── validate-content.mjs           # Question, source-audit, citation, and duplicate checks
├── src/
│   ├── main.ts                        # App initialization and view routing
│   ├── styles.css                     # Mobile-first visual system and responsive layout
│   ├── data/
│   │   ├── types.ts                   # Shared content and learner-state contracts
│   │   └── load.ts                    # Fetch and runtime-validate static assets
│   ├── domain/
│   │   ├── scoring.ts                 # Four-format answer normalization and scoring
│   │   ├── mastery.ts                 # Attempt-driven concept mastery and review due dates
│   │   └── selector.ts                # Diagnostic, daily, source, and mock group selection
│   ├── state/
│   │   └── storage.ts                 # Versioned local state, recovery, export/import/reset
│   └── ui/
│       ├── shell.ts                   # Header, navigation, main region, and announcements
│       ├── home.ts                    # Daily action, target date, progress, domain mastery
│       ├── practice.ts                # All question controls and submit confirmation
│       ├── results.ts                 # Scores, explanations, sources, weak-concept actions
│       ├── library.ts                 # Bank filters, source groups, and untimed mock launch
│       ├── cheatsheet.ts              # Weak-first domain notes and download/print
│       └── settings.ts                # Date, backup/restore, and confirmed reset
└── tests/
    ├── fixtures/
    │   ├── captions.xml               # Small caption retrieval fixture
    │   ├── questions.json             # Four-format valid question fixture
    │   └── state.json                 # Valid versioned learner state
    ├── content.test.ts                # Static bank and source-audit acceptance tests
    ├── scoring.test.ts                # Exact scoring semantics
    ├── mastery.test.ts                # Mastery and spaced-review behavior
    ├── selector.test.ts               # 25-question composition and fallbacks
    ├── storage.test.ts                # Persistence, recovery, import/export/reset
    └── app.test.ts                    # Key mobile study flows and answer hiding
```

---

### Task 1: Static App Foundation and Data Contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/main.ts`
- Create: `src/data/types.ts`
- Create: `tests/fixtures/questions.json`
- Create: `tests/scoring.test.ts`

**Interfaces:**
- Produces: `Question`, `QuestionType`, `SourceRef`, `VerificationRef`, `LearnerState`, `Attempt`, `StudySession`, and `Answer` types.
- Produces: package commands `dev`, `build`, `test`, `validate:content`, and `check`.

- [ ] **Step 1: Add package configuration, fixture, and the first failing scoring test**

Create `package.json` with `"type": "module"`, the scripts from the global file structure, and development dependencies `@types/node`, `jsdom`, `typescript`, `vite`, and `vitest`. Create `tests/fixtures/questions.json` with the four complete records described in Step 3. Create `tests/scoring.test.ts` with the fixture import and calls to the planned `scoreAnswer(question, answer)` interface:

```ts
import { describe, expect, it } from "vitest";
import questions from "./fixtures/questions.json";
import { scoreAnswer } from "../src/domain/scoring";
import type { Answer, Question } from "../src/data/types";

const bank = questions as Question[];

describe("scoreAnswer", () => {
  it.each([
    ["multiple-choice", "b"],
    ["multiple-response", ["a", "c"]],
    ["ordering", ["collect", "prepare", "train", "evaluate"]],
    ["matching", { pii: "Comprehend", images: "Rekognition" }],
  ] as const)("scores an exact %s response", (type, answer) => {
    const question = bank.find((item) => item.type === type)!;
    expect(scoreAnswer(question, answer as Answer).correct).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npm install && npm test -- --run tests/scoring.test.ts`

Expected: FAIL because `src/domain/scoring.ts` and shared data types do not exist.

- [ ] **Step 3: Add strict project configuration and shared contracts**

Define `Question` as a discriminated union. Use exact answer shapes:

```ts
export type QuestionType =
  | "multiple-choice"
  | "multiple-response"
  | "ordering"
  | "matching";

export type Answer = string | string[] | Record<string, string>;

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
  type: QuestionType;
  prompt: string;
  domain: 1 | 2 | 3 | 4 | 5;
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

export interface LearnerState {
  version: 1;
  settings: { targetDate: string };
  attempts: Record<string, Attempt[]>;
  mastery: Record<
    string,
    { score: number; successStreak: number; dueOn: string }
  >;
  sessions: StudySession[];
  inProgress?: {
    id: string;
    mode: StudySession["mode"];
    questionIds: string[];
    answers: Record<string, Answer>;
    currentIndex: number;
  };
}
```

Ensure the four fixture records use the exact correct answers referenced by the test: choice `b`, response IDs `a` and `c`, ordered IDs `collect`, `prepare`, `train`, `evaluate`, and matches `pii` → `Comprehend`, `images` → `Rekognition`. Give every record complete source, verification, explanation, domain, task, concept, service, and fingerprint fields.

- [ ] **Step 4: Add the minimal static shell**

Create an accessible `index.html` with a skip link, `#app`, and module entry `/src/main.ts`. Add mobile-first base styles using native system fonts, a calm navy/teal palette, 44px minimum tap targets, visible focus rings, and a content width capped at 72rem.

- [ ] **Step 5: Run type checking and confirm only scoring remains red**

Run: `npx tsc --noEmit && npm test -- --run tests/scoring.test.ts`

Expected: type checking succeeds; the test still fails only because scoring is not implemented.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src tests/fixtures/questions.json
git commit -m "chore: scaffold static study app"
```

---

### Task 2: Source Catalog, Captions, and Audit Pipeline

**Files:**
- Create: `scripts/youtube-source.mjs`
- Create: `scripts/build-source-audit.mjs`
- Create: `scripts/normalize-question.mjs`
- Create: `tests/fixtures/captions.xml`
- Create: `public/data/source-videos.json`
- Create: `public/data/source-audit.json`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces: `normalizeText(text): string` and `fingerprintQuestion(prompt, concepts): string`.
- Produces: source audit entries with status `included`, `merged`, `corrected`, or `excluded`.
- Produces: a video catalog for playlist IDs `PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf` and `PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_`.

- [ ] **Step 1: Write failing source-accounting tests**

Create `tests/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import audit from "../public/data/source-audit.json";
import videos from "../public/data/source-videos.json";

describe("source audit", () => {
  it("catalogs both supplied playlists", () => {
    expect(new Set(videos.map((video) => video.playlistId))).toEqual(
      new Set([
        "PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf",
        "PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_",
      ]),
    );
  });

  it("gives every recovered source question a final disposition", () => {
    expect(audit.length).toBeGreaterThan(540);
    expect(
      audit.every((entry) =>
        ["pending", "included", "merged", "corrected", "excluded"].includes(
          entry.status,
        ),
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the source tests and confirm missing-data failure**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL because the source catalog and audit assets do not exist.

- [ ] **Step 3: Implement deterministic normalization**

`normalizeText` must lowercase, Unicode-normalize, remove punctuation, collapse whitespace, and normalize AWS service aliases without changing semantic terms. `fingerprintQuestion` must hash normalized prompt plus sorted concept tags with SHA-256.

Test exact duplicates:

```ts
expect(normalizeText("Amazon SageMaker AI — which service?"))
  .toBe(normalizeText("amazon sagemaker ai, which service"));
```

- [ ] **Step 4: Implement playlist and caption retrieval**

`youtube-source.mjs` must:

1. Fetch each supplied watch page.
2. Parse `ytInitialData` for playlist video IDs, titles, order, and length.
3. Parse `ytInitialPlayerResponse` for English caption tracks.
4. Fetch timed-text captions when present.
5. Store reproducible metadata and source URLs without storing video media.
6. Mark non-question videos such as exam-details or result-only videos as `informational`.

The script command is:

```bash
node scripts/youtube-source.mjs \
  PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf \
  PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_
```

- [ ] **Step 5: Build the source-question audit**

Segment captions using spoken question numbers, option markers, answer announcements, and timestamp gaps. Preserve uncertain segments for manual frame/caption inspection rather than dropping them. The audit record shape is:

```json
{
  "sourceKey": "videoId:questionNumber",
  "playlistId": "PL...",
  "videoId": "abc",
  "questionNumber": 1,
  "timestampSeconds": 42,
  "promptSummary": "Service for extracting text and entities",
  "statedAnswer": "Amazon Comprehend",
  "status": "pending",
  "reason": "Recovered from captions and awaiting answer verification"
}
```

- [ ] **Step 6: Inspect every uncertain segment**

Use its timestamped YouTube URL and captions to recover the prompt, response options, and stated answer. If the video does not expose enough information after caption and visible-frame inspection, mark `excluded` with the exact reason. Otherwise mark it `pending` for Tasks 4–6. The acceptance condition is that no audit record has an empty status, empty reason, or missing source location.

- [ ] **Step 7: Run source accounting tests**

Run: `npm test -- --run tests/content.test.ts`

Expected: PASS for playlist catalog and audit disposition.

- [ ] **Step 8: Commit the source pipeline**

```bash
git add scripts public/data/source-videos.json public/data/source-audit.json tests
git commit -m "feat: audit practice exam sources"
```

---

### Task 3: Content Validator and Correction Report Contract

**Files:**
- Create: `scripts/validate-content.mjs`
- Create: `public/data/questions.json`
- Create: `public/data/cheat-sheet.json`
- Create: `source-answer-corrections.txt`
- Modify: `tests/content.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `normalizeText` and `fingerprintQuestion`.
- Produces: command `npm run validate:content`.
- Produces: a schema-valid four-question seed bank; Tasks 4–6 replace the seed with the complete audited bank.

- [ ] **Step 1: Add failing validator acceptance tests**

Add tests that require every question to have a unique ID, unique normalized prompt, unique fingerprint, nonempty explanation, domain/task, source provenance, and at least one HTTPS verification URL dated on or after `2026-07-29`.

```ts
it("ships no exact duplicate prompts or fingerprints", () => {
  const prompts = questions.map((q) => normalizeText(q.prompt));
  const fingerprints = questions.map((q) => q.fingerprint);
  expect(new Set(prompts).size).toBe(prompts.length);
  expect(new Set(fingerprints).size).toBe(fingerprints.length);
});
```

- [ ] **Step 2: Run tests and confirm the validator failures**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL because the bank, cheat sheet, and report contracts are incomplete.

- [ ] **Step 3: Implement `validate-content.mjs`**

The validator must exit nonzero for:

- Invalid question type or answer shape
- Missing option IDs or duplicate option IDs
- Correct IDs absent from options
- Missing explanation, domain, task, concepts, sources, or verification
- Non-HTTPS verification URLs
- Duplicate stable IDs, normalized prompts, or fingerprints
- Final source-audit entries that point to missing bank IDs
- Bank source references absent from the source catalog
- Empty cheat-sheet domains
- A corrections report entry missing source, stated answer, corrected answer, reason, link, or date

Support `--allow-pending` during domain curation. Without the flag, any `pending` source-audit entry is a validation failure. Add package scripts:

```json
{
  "validate:content": "node scripts/validate-content.mjs",
  "validate:content:work": "node scripts/validate-content.mjs --allow-pending"
}
```

- [ ] **Step 4: Define the correction report format**

Start `source-answer-corrections.txt` with:

```text
AWS AIF-C01 SOURCE ANSWER CORRECTIONS
Verified against current authoritative documentation.

Entry format:
Source:
Question location:
Question summary:
Source stated:
Verified answer:
Why:
Verification:
Verified on:
```

Confirmed errors are appended in that exact format. If the final audit finds none, replace the format guide with an explicit no-confirmed-errors statement and the verification date.

- [ ] **Step 5: Run content validation**

Run: `npm run validate:content:work`

Expected: PASS for schema mechanics, pending audit integrity, and the four-question seed bank; Tasks 4–6 add the audited domain content and complete source accounting.

- [ ] **Step 6: Commit validation contracts**

```bash
git add scripts/validate-content.mjs public/data package.json source-answer-corrections.txt tests/content.test.ts
git commit -m "test: enforce verified question content"
```

---

### Task 4: Curate and Verify Domains 1 and 2

**Files:**
- Modify: `public/data/questions.json`
- Modify: `public/data/source-audit.json`
- Modify: `public/data/cheat-sheet.json`
- Modify: `source-answer-corrections.txt`

**Interfaces:**
- Consumes: question schema and source audit.
- Produces: verified Domain 1 and Domain 2 questions with all matching audit entries resolved.

- [ ] **Step 1: Add Domain 1 and 2 audit assertions**

Extend `tests/content.test.ts` to require at least one question for every current task statement in Domains 1 and 2 and all four response formats across the combined bank.

```ts
for (const task of ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3"]) {
  expect(questions.some((question) => question.task === task)).toBe(true);
}
```

- [ ] **Step 2: Run tests to expose missing task coverage**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL listing uncovered task statements or formats.

- [ ] **Step 3: Curate Domain 1**

For every source audit segment about AI/ML fundamentals, use cases, or the development lifecycle:

1. Recover the complete scenario and response set.
2. Verify against the current Domain 1 objectives and linked AWS service documentation.
3. Rewrite unclear wording.
4. Add distractor explanations.
5. Merge duplicates and attach all source references.
6. Update each audit status and reason.
7. Log every confirmed video-answer error.

- [ ] **Step 4: Curate Domain 2**

Repeat the process for GenAI concepts, use cases, limitations, responsible business selection, tokens, embeddings, vectors, transformers, diffusion, model lifecycle, and AWS GenAI infrastructure.

- [ ] **Step 5: Add Domain 1 and 2 cheat-sheet entries**

Each entry uses:

```json
{
  "id": "d2-embeddings",
  "domain": 2,
  "title": "Embeddings",
  "memoryHook": "Meaning becomes coordinates.",
  "facts": ["Embeddings represent semantic meaning as vectors."],
  "confusions": ["Embeddings are not the same as tokenization."],
  "sourceUrl": "https://docs.aws.amazon.com/..."
}
```

- [ ] **Step 6: Validate and commit**

Run: `npm run validate:content:work && npm test -- --run tests/content.test.ts`

Expected: PASS for Domains 1 and 2.

```bash
git add public/data source-answer-corrections.txt tests/content.test.ts
git commit -m "feat: add verified AI and GenAI questions"
```

---

### Task 5: Curate and Verify Domain 3

**Files:**
- Modify: `public/data/questions.json`
- Modify: `public/data/source-audit.json`
- Modify: `public/data/cheat-sheet.json`
- Modify: `source-answer-corrections.txt`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Produces: verified coverage for task statements `3.1`, `3.2`, `3.3`, and `3.4`.

- [ ] **Step 1: Add failing Domain 3 task assertions**

Require all four task statements plus questions covering RAG, prompt engineering, model selection, fine-tuning, evaluation metrics, and human evaluation.

- [ ] **Step 2: Run the targeted content test**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL for missing Domain 3 objectives.

- [ ] **Step 3: Curate every Domain 3 source segment**

Verify each answer against the current AIF-C01 Domain 3 guide plus direct Amazon Bedrock or SageMaker AI documentation. Consolidate semantic duplicates, retain all provenance, and log confirmed source corrections.

- [ ] **Step 4: Add verified ordering and matching questions**

Add original ordering questions for a defensible lifecycle sequence and matching questions for prompt techniques, evaluation methods, or Bedrock capabilities. Do not invent a strict order for processes that AWS describes as non-sequential.

- [ ] **Step 5: Add Domain 3 cheat-sheet entries**

Cover RAG versus fine-tuning, inference parameters, prompt patterns, evaluation dimensions, and model-selection tradeoffs.

- [ ] **Step 6: Validate and commit**

Run: `npm run validate:content:work && npm test -- --run tests/content.test.ts`

Expected: PASS for Domain 3.

```bash
git add public/data source-answer-corrections.txt tests/content.test.ts
git commit -m "feat: add verified foundation model questions"
```

---

### Task 6: Curate and Verify Domains 4 and 5

**Files:**
- Modify: `public/data/questions.json`
- Modify: `public/data/source-audit.json`
- Modify: `public/data/cheat-sheet.json`
- Modify: `source-answer-corrections.txt`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Produces: verified coverage for task statements `4.1`, `4.2`, `5.1`, `5.2`, and `5.3`.
- Completes: all non-informational source audit entries.

- [ ] **Step 1: Add failing Domain 4 and 5 assertions**

Require task coverage plus questions on bias/fairness, transparency/explainability, responsible AI, IAM, encryption, data privacy, shared responsibility, governance, compliance, and auditability.

- [ ] **Step 2: Run the targeted content test**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL for missing Domain 4 or 5 objectives.

- [ ] **Step 3: Curate Domain 4**

Verify responsible-AI and explainability answers against the current exam guide and AWS responsible-AI documentation. Reject absolute claims not supported by AWS.

- [ ] **Step 4: Curate Domain 5**

Verify security, compliance, privacy, governance, and service-feature answers against direct AWS IAM, KMS, CloudTrail, Artifact, Config, Macie, Bedrock, and shared-responsibility documentation as applicable.

- [ ] **Step 5: Finalize the source audit and corrections report**

Assert that every recovered practice question is `included`, `merged`, `corrected`, or `excluded`; every non-excluded entry points to a real bank ID; and every excluded entry states why the prompt or answer could not be defensibly recovered.

- [ ] **Step 6: Add Domains 4 and 5 cheat-sheet entries**

Include high-yield confusions such as identity versus encryption, logging versus configuration evaluation, data discovery versus data classification, and provider-versus-customer responsibilities.

- [ ] **Step 7: Validate and commit**

Run: `npm run validate:content && npm test -- --run tests/content.test.ts`

Expected: PASS for all domains and source accounting.

```bash
git add public/data source-answer-corrections.txt tests/content.test.ts
git commit -m "feat: complete verified governance question bank"
```

---

### Task 7: Four-Format Scoring

**Files:**
- Create: `src/domain/scoring.ts`
- Modify: `tests/scoring.test.ts`

**Interfaces:**
- Produces: `normalizeAnswer(question, answer): Answer`.
- Produces: `scoreAnswer(question, answer): { correct: boolean; expected: Answer; received: Answer }`.
- Produces: `scoreGroup(questions, answers): GroupScore`, where `GroupScore` is:

```ts
export interface GroupScore {
  total: number;
  correct: number;
  percentage: number;
  byDomain: Record<1 | 2 | 3 | 4 | 5, { total: number; correct: number }>;
}
```

- [ ] **Step 1: Complete failing exactness tests**

Require multiple-response to be order-independent but exact, ordering to be order-dependent, matching to require every pair, and unanswered to be incorrect.

```ts
expect(scoreAnswer(multi, ["c", "a"]).correct).toBe(true);
expect(scoreAnswer(multi, ["a"]).correct).toBe(false);
expect(scoreAnswer(ordering, ["prepare", "collect", "train", "evaluate"]).correct)
  .toBe(false);
expect(scoreAnswer(matching, { pii: "Comprehend" }).correct).toBe(false);
expect(scoreAnswer(choice, "").correct).toBe(false);
```

- [ ] **Step 2: Run scoring tests**

Run: `npm test -- --run tests/scoring.test.ts`

Expected: FAIL because scoring is missing.

- [ ] **Step 3: Implement exact scoring**

Normalize only representation noise: sort multiple-response IDs, preserve ordering arrays, sort matching object keys, and treat missing answers as incorrect. Calculate total, correct, percentage, and per-domain counts in `scoreGroup`.

- [ ] **Step 4: Run scoring tests**

Run: `npm test -- --run tests/scoring.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scoring.ts tests/scoring.test.ts
git commit -m "feat: score all AIF-C01 question formats"
```

---

### Task 8: Mastery and Adaptive Selection

**Files:**
- Create: `src/domain/mastery.ts`
- Create: `src/domain/selector.ts`
- Create: `tests/mastery.test.ts`
- Create: `tests/selector.test.ts`

**Interfaces:**
- Produces: `recordAttempt(state, question, correct, completedAt): LearnerState`.
- Produces: `conceptMastery(state, concept): number` in the range `0..1`.
- Produces: `selectDailyGroup(bank, state, today, size = 25): Question[]`.
- Produces: `selectMock(bank, size = 65, seed): Question[]`.
- Produces: `selectSourceGroup(bank, videoId): Question[]`.

- [ ] **Step 1: Write failing mastery tests**

Test that an incorrect answer lowers mastery and is due next session, while three spaced correct answers increase mastery and push review farther out.

- [ ] **Step 2: Write failing selector tests**

Build a 100-question deterministic fixture and assert:

```ts
const group = selectDailyGroup(bank, state, "2026-07-30");
expect(group).toHaveLength(25);
expect(new Set(group.map((q) => q.id)).size).toBe(25);
expect(new Set(group.map((q) => q.fingerprint)).size).toBe(25);
expect(countWeak(group)).toBeGreaterThanOrEqual(12);
expect(countUnseen(group)).toBeGreaterThanOrEqual(7);
expect(countReview(group)).toBeGreaterThanOrEqual(5);
```

Also test the balanced first-session diagnostic, depleted-pool fallback, domain breadth, reproducible daily selection, 65-question mock uniqueness, and source-group provenance.

- [ ] **Step 3: Run domain tests**

Run: `npm test -- --run tests/mastery.test.ts tests/selector.test.ts`

Expected: FAIL because mastery and selection are missing.

- [ ] **Step 4: Implement mastery**

Use a transparent score:

- Start concept mastery at `0.35`.
- Incorrect: subtract `0.20`, floor at `0`, due the next calendar day.
- Correct: add `0.15`, cap at `1`.
- Correct-answer review interval: `1`, `3`, `7`, `14`, then `30` days based on consecutive spaced successes.
- An incorrect answer resets the success streak to `0`.

- [ ] **Step 5: Implement selection**

Use seeded shuffling for reproducibility. For post-diagnostic groups, request 13 weak/due, 7 unseen, and 5 spaced-review questions. Fill deficits from unseen, due, then lowest-mastery remaining questions. Enforce unique IDs and fingerprints and include at least three domains when the bank permits.

- [ ] **Step 6: Run domain tests**

Run: `npm test -- --run tests/mastery.test.ts tests/selector.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain tests/mastery.test.ts tests/selector.test.ts
git commit -m "feat: add adaptive daily study selection"
```

---

### Task 9: Versioned Local Persistence

**Files:**
- Create: `src/state/storage.ts`
- Create: `tests/storage.test.ts`
- Create: `tests/fixtures/state.json`

**Interfaces:**
- Produces: `loadState(storage): LoadResult`, where:

```ts
export interface LoadResult {
  state: LearnerState;
  recoveryPayload?: string;
  error?: string;
}
```

- Produces: `saveState(storage, state): void`.
- Produces: `exportState(state): string`.
- Produces: `importState(json): LearnerState`.
- Produces: `resetState(storage): LearnerState`.

- [ ] **Step 1: Write failing storage tests**

Test defaults, save/load, in-progress answers, corrupt JSON, unsupported versions, export/import round trips, invalid import rejection, and reset.

```ts
expect(loadState(storage).state.settings.targetDate).toBe("2026-08-31");
expect(() => importState('{"version":999}')).toThrow(/unsupported/i);
expect(importState(exportState(validState))).toEqual(validState);
```

- [ ] **Step 2: Run storage tests**

Run: `npm test -- --run tests/storage.test.ts`

Expected: FAIL because storage is missing.

- [ ] **Step 3: Implement storage and recovery**

Use key `aws-aif-study-state`. `loadState` returns `{ state, recoveryPayload?, error? }`; malformed data must never be silently destroyed. Validate imported objects before replacing current state. `resetState` removes only this app's storage key.

- [ ] **Step 4: Run storage tests**

Run: `npm test -- --run tests/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/storage.ts tests/storage.test.ts tests/fixtures/state.json
git commit -m "feat: persist study progress locally"
```

---

### Task 10: Data Loading, Shell, Home, and Practice

**Files:**
- Create: `src/data/load.ts`
- Create: `src/ui/shell.ts`
- Create: `src/ui/home.ts`
- Create: `src/ui/practice.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `tests/app.test.ts`

**Interfaces:**
- Produces: `loadContent(): Promise<AppContent>`.
- Produces: `renderShell(root, context): AppShell`.
- Produces: `renderHome(container, context): void`.
- Produces: `renderPractice(container, session, context): void`.

Use these shared UI contracts:

```ts
export interface CheatSheetEntry {
  id: string;
  domain: 1 | 2 | 3 | 4 | 5;
  title: string;
  memoryHook: string;
  facts: string[];
  confusions: string[];
  sourceUrl: string;
}

export interface AppContent {
  questions: Question[];
  videos: SourceVideo[];
  cheatSheet: CheatSheetEntry[];
}

export interface AppContext {
  content: AppContent;
  getState(): LearnerState;
  setState(state: LearnerState): void;
  navigate(route: string): void;
  announce(message: string): void;
}

export interface AppShell {
  main: HTMLElement;
  navigate(route: string): void;
  announce(message: string): void;
}
```

- [ ] **Step 1: Write failing app-flow tests**

In jsdom, load a fixture bank and assert:

- Home shows `Start today's 25 questions`.
- Target date renders as August 31, 2026.
- Starting practice renders one question and answered progress.
- Navigating preserves responses.
- No element containing `Correct answer`, explanation text, or correctness class exists before submission.
- Ordering buttons change item order.
- Matching controls assign a target to each prompt.
- Unanswered submission requests confirmation.

- [ ] **Step 2: Run the app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: FAIL because UI modules are missing.

- [ ] **Step 3: Implement runtime data loading**

Fetch `/data/questions.json`, `/data/source-videos.json`, and `/data/cheat-sheet.json`; validate required top-level arrays and fail into an accessible error panel with a retry button.

- [ ] **Step 4: Implement the app shell and routing**

Use hash routes `#/home`, `#/practice`, `#/results`, `#/library`, `#/cheatsheet`, and `#/settings`. Include a compact phone navigation bar, skip link, and `aria-live` status region.

- [ ] **Step 5: Implement the home dashboard**

Render the primary daily action, resume action, editable target summary, days remaining, first-20-hours progress, bank coverage, overall mastery, and five domain bars.

- [ ] **Step 6: Implement practice controls**

Render radio buttons, checkboxes, ordering move-up/move-down buttons, and matching selects. Autosave after every answer and navigation change. Do not import answer explanations into the pre-submission rendering branch.

- [ ] **Step 7: Run app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: PASS for home and practice behavior.

- [ ] **Step 8: Commit**

```bash
git add src tests/app.test.ts
git commit -m "feat: build mobile daily practice flow"
```

---

### Task 11: Results, Library, Cheat Sheet, and Settings

**Files:**
- Create: `src/ui/results.ts`
- Create: `src/ui/library.ts`
- Create: `src/ui/cheatsheet.ts`
- Create: `src/ui/settings.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/app.test.ts`

**Interfaces:**
- Consumes: scoring, selection, mastery, persistence, and loaded static content.
- Produces: complete result review, filtered source practice, mocks, weak-first notes, and data controls.

- [ ] **Step 1: Add failing post-submission and secondary-view tests**

Assert:

- Submission records exactly one completed session.
- Results show total and domain scores.
- Every reviewed question shows the expected answer, explanation, and clickable verification links.
- Choice distractors render their reasons.
- Library filters by domain, type, source, and attempt state.
- Mock launch selects 65 unique questions without a timer.
- Cheat sheet sorts weak concepts first and still filters by domain.
- Export creates valid JSON, invalid import is rejected, and reset requires confirmation.

- [ ] **Step 2: Run app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: FAIL for missing secondary views.

- [ ] **Step 3: Implement results**

Score the submitted group once, update mastery once per question, persist the completed session, clear in-progress state, and render explanations plus source links. Guard against double submission by session ID.

- [ ] **Step 4: Implement library**

Provide filters, result counts, source video grouping, `Start source group`, and `Start 65-question mock`. When a filtered set has fewer requested questions, state the available number without duplication.

- [ ] **Step 5: Implement cheat sheet**

Rank entries by the lowest associated concept mastery, provide five domain filters, and add native print plus a text-file download assembled from the filtered entries.

- [ ] **Step 6: Implement settings**

Update the target date, export state to a dated JSON file, validate and confirm import replacement, offer corrupt-state recovery download when present, and require typed or explicit modal confirmation for reset.

- [ ] **Step 7: Run app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src tests/app.test.ts
git commit -m "feat: complete study review and library"
```

---

### Task 12: Accessibility, Production Build, and VPS Handoff

**Files:**
- Create: `README.md`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `dist/` static output.
- Produces: one-command quality gate `npm run check`.

- [ ] **Step 1: Define the complete quality command**

Set:

```json
{
  "scripts": {
    "test": "vitest",
    "validate:content": "node scripts/validate-content.mjs",
    "build": "tsc --noEmit && vite build",
    "check": "npm run validate:content && npm test -- --run && npm run build"
  }
}
```

- [ ] **Step 2: Run the full quality gate**

Run: `npm run check`

Expected: all content checks and tests pass, and `dist/index.html` plus static assets are produced.

- [ ] **Step 3: Fix only observed quality failures**

For each failure, first add or tighten a regression assertion, then make the smallest implementation or content correction. Re-run the failing command and finally `npm run check`.

- [ ] **Step 4: Verify the phone study flow**

Start `npm run dev`, open the printed local URL, and verify at phone width:

1. Start today's group.
2. Answer all four question formats.
3. Reload and confirm resume.
4. Submit and confirm answers first appear on results.
5. Open a verification link.
6. Start an untimed mock.
7. Export and re-import progress.
8. Filter and download the cheat sheet.

Expected: no horizontal overflow, clipped controls, inaccessible labels, answer leakage, duplicate questions, or timer.

- [ ] **Step 5: Write VPS deployment instructions**

Document:

```bash
npm ci
npm run check
rsync -av --delete dist/ user@your-vps:/var/www/aws-aif-study/
```

Explain that any static HTTP server can serve `dist/`, progress is browser-local, and JSON export is the backup mechanism.

- [ ] **Step 6: Stop the development server and commit**

```bash
git add README.md index.html src/styles.css package.json package-lock.json
git commit -m "docs: add verified VPS deployment handoff"
```

- [ ] **Step 7: Perform final verification**

Run:

```bash
npm run check
git status --short
```

Expected: all checks pass and the worktree is clean.
