# Simplified Practice-Exam App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the target-date learning planner with a static, mobile-first app containing five numbered 65-question exams, an adaptive Cheat Sheet, and a question-governance Library.

**Architecture:** Checked-in JSON manifests define stable exam membership and review status. A version-2 browser-local state stores attempts, exam scores, mastery queues, and one resumable exam/retry round; route renderers remain framework-free TypeScript and use event delegation from `src/main.ts`.

**Tech Stack:** TypeScript 5.9, Vite 7, Vitest 3, jsdom, static JSON, browser `localStorage`.

## Global Constraints

- Bottom navigation contains exactly Practice Exams, Cheat Sheet, and Library.
- There is no target date, learning-plan UI, timer, login, backend, VPS storage, Settings route, source-group launcher, or official AWS practice-exam card.
- Five numbered local exams contain exactly 65 question IDs each.
- Practice Exams 1–4 contain 260 distinct Verified questions; Practice Exam 5 contains the remaining 7 plus 58 fixed, domain-weighted repeats without duplicates inside the exam.
- Unverified and Conflicted questions remain Library-only.
- Exam pages contain at most 10 questions and show `Practice Exam N: X of 65 answered` in the bottom controls.
- Answers and explanations remain hidden until submission.
- Results review wrong answers only; Continue practice retries the current wrong queue until every item is answered correctly.
- Retry scores never replace the original 65-question score.
- Every incorrect attempt is appended to browser history and the detailed TXT report.
- Cheat Sheet starts in a fixed First 20 Hours order, then browser-local wrong-answer history promotes related cards.
- English is the only supported language and all four question formats remain supported.

---

### Task 1: Stable Exam and Review Manifests

**Files:**
- Create: `scripts/build-practice-exams.mjs`
- Create: `public/data/practice-exams.json`
- Create: `public/data/question-reviews.json`
- Modify: `scripts/validate-content.mjs`
- Modify: `src/data/types.ts`
- Modify: `src/data/load.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces: `PracticeExam { id: number; title: string; version: number; questionIds: string[] }`
- Produces: `QuestionReview { questionId: string; status: "verified" | "unverified" | "conflicted"; reason: string; proof: VerificationRef[]; sourceClaim?: string }`
- Produces: `AppContent.exams: PracticeExam[]` and `AppContent.reviews: QuestionReview[]`
- Consumes: `public/data/questions.json` and the known conflict ID `aif-d5-sse-s3-object-access-scenario`

- [ ] **Step 1: Write manifest contract tests**

```ts
import exams from "../public/data/practice-exams.json";
import reviews from "../public/data/question-reviews.json";

it("ships five stable Verified-only 65-question exams", () => {
  expect(exams.map((exam) => exam.id)).toEqual([1, 2, 3, 4, 5]);
  expect(exams.every((exam) => exam.questionIds.length === 65)).toBe(true);
  expect(exams.every((exam) => new Set(exam.questionIds).size === 65)).toBe(true);
  const status = new Map(reviews.map((review) => [review.questionId, review.status]));
  expect(exams.flatMap((exam) => exam.questionIds).every((id) => status.get(id) === "verified")).toBe(true);
});

it("keeps one corrected source conflict out of every exam", () => {
  expect(reviews.filter((review) => review.status === "verified")).toHaveLength(267);
  expect(reviews.filter((review) => review.status === "conflicted")).toEqual([
    expect.objectContaining({ questionId: "aif-d5-sse-s3-object-access-scenario" })
  ]);
  expect(exams.flatMap((exam) => exam.questionIds)).not.toContain(
    "aif-d5-sse-s3-object-access-scenario"
  );
});
```

- [ ] **Step 2: Run the content tests and confirm the missing JSON imports fail**

Run: `npm test -- --run tests/content.test.ts`

Expected: FAIL because `practice-exams.json` and `question-reviews.json` do not exist.

- [ ] **Step 3: Implement deterministic manifest generation**

`scripts/build-practice-exams.mjs` must:

```js
const CONFLICT_ID = "aif-d5-sse-s3-object-access-scenario";
const verified = questions.filter((question) => question.id !== CONFLICT_ID);
const stable = [...verified].sort(
  (left, right) =>
    left.domain - right.domain ||
    left.difficulty.localeCompare(right.difficulty) ||
    left.id.localeCompare(right.id)
);
```

Distribute the first 260 IDs round-robin into four 65-item exams so each gets a domain and difficulty mix. Put the remaining seven IDs into Exam 5, then append the first 58 IDs from a domain-weighted stable candidate list, skipping IDs already present in Exam 5. Generate 267 `verified` review records from each question's official verification, plus one `conflicted` record whose reason states that SSE-S3 requires `s3:GetObject` and does not require KMS decrypt permission. Write both files with two-space indentation and a trailing newline.

- [ ] **Step 4: Add types, loading, and validator contracts**

Extend `AppContent`:

```ts
export interface PracticeExam {
  id: number;
  title: string;
  version: number;
  questionIds: string[];
}

export type ReviewStatus = "verified" | "unverified" | "conflicted";

export interface QuestionReview {
  questionId: string;
  status: ReviewStatus;
  reason: string;
  proof: VerificationRef[];
  sourceClaim?: string;
}
```

Load the two new JSON files in `loadContent()`. Extend `validate-content.mjs` to require five sequential exam IDs, 65 unique IDs per exam, Verified-only membership, exactly 268 review records, one review per question, and no unreviewed question IDs.

- [ ] **Step 5: Generate data and run content validation**

Run: `node scripts/build-practice-exams.mjs && npm run validate:content && npm test -- --run tests/content.test.ts`

Expected: PASS with 267 Verified, 0 Unverified, 1 Conflicted, and five valid exams.

- [ ] **Step 6: Commit stable content manifests**

```bash
git add scripts/build-practice-exams.mjs scripts/validate-content.mjs public/data/practice-exams.json public/data/question-reviews.json src/data/types.ts src/data/load.ts tests/content.test.ts
git commit -m "feat: add stable verified practice exams"
```

### Task 2: Version-2 Browser State and Migration

**Files:**
- Modify: `src/data/types.ts`
- Rewrite: `src/state/storage.ts`
- Modify: `tests/storage.test.ts`
- Modify: `tests/fixtures/state.json`

**Interfaces:**
- Produces: `LearnerState` version 2 with `attempts`, `examResults`, `inProgress`, and `wrongHistory`
- Produces: `InProgressExam { id; examId; mode; questionIds; answers; page; originalQuestionIds; masteryQueue }`
- Produces: `ExamResult { examId; score; correct; total; completedAt; mastered }`
- Consumes: compatible `attempts` from version-1 state

- [ ] **Step 1: Replace storage tests with version-2 and migration coverage**

```ts
it("starts with empty browser-only exam state", () => {
  expect(loadState(new MemoryStorage()).state).toEqual({
    version: 2,
    attempts: {},
    examResults: {},
    wrongHistory: []
  });
});

it("migrates v1 attempts and discards target and planner fields", () => {
  storage.setItem(STORAGE_KEY, JSON.stringify(versionOneFixture));
  const migrated = loadState(storage).state;
  expect(migrated.version).toBe(2);
  expect(migrated.attempts).toEqual(versionOneFixture.attempts);
  expect(migrated).not.toHaveProperty("settings");
  expect(migrated).not.toHaveProperty("mastery");
  expect(migrated).not.toHaveProperty("sessions");
});
```

Keep corrupt-payload preservation coverage and remove Settings-only import, export, and reset expectations.

- [ ] **Step 2: Run storage tests and confirm version mismatch failures**

Run: `npm test -- --run tests/storage.test.ts`

Expected: FAIL because the implementation still emits version 1.

- [ ] **Step 3: Implement strict state-v2 validation and v1 migration**

Define:

```ts
export interface WrongAttempt extends Attempt {
  examId: number;
  roundId: string;
}

export interface LearnerState {
  version: 2;
  attempts: Record<string, Attempt[]>;
  examResults: Record<string, ExamResult>;
  wrongHistory: WrongAttempt[];
  inProgress?: InProgressExam;
}
```

`loadState()` parses version 2 directly, migrates version 1 by copying only structurally valid attempts, and preserves invalid JSON under `RECOVERY_KEY`. `saveState()` continues to validate before writing.

- [ ] **Step 4: Run focused storage tests**

Run: `npm test -- --run tests/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit state migration**

```bash
git add src/data/types.ts src/state/storage.ts tests/storage.test.ts tests/fixtures/state.json
git commit -m "feat: migrate local progress to exam state"
```

### Task 3: Three-Route Shell and Exam Catalog

**Files:**
- Create: `src/ui/exams.ts`
- Modify: `src/ui/shell.ts`
- Modify: `src/ui/types.ts`
- Modify: `src/main.ts`
- Modify: `tests/app.test.ts`

**Interfaces:**
- Produces: public routes `"exams" | "cheatsheet" | "library"`
- Keeps: internal routes `"practice" | "results"`
- Produces actions `start-exam`, `resume-exam`, and `open-results`, with `data-exam-id`

- [ ] **Step 1: Write navigation and catalog tests**

```ts
it("shows only the three requested bottom destinations", async () => {
  app = await bootApp(root, { content, storage, now: fixedNow });
  expect([...root.querySelectorAll(".bottom-nav a")].map((link) => link.textContent?.trim()))
    .toEqual(["Practice Exams", "Cheat Sheet", "Library"]);
  expect(root.textContent).not.toMatch(/target|today|settings|official practice exam/i);
});

it("lists five numbered local exams with stable counts", async () => {
  expect([...root.querySelectorAll("[data-exam-id]")]).toHaveLength(5);
  expect(root.textContent).toContain("Practice Exam 1");
  expect(root.textContent).toContain("65 questions");
});
```

- [ ] **Step 2: Run the app tests and confirm old navigation fails**

Run: `npm test -- --run tests/app.test.ts`

Expected: FAIL because Today and Settings still render.

- [ ] **Step 3: Implement the shell and catalog**

Set `#/exams` as the default route and brand link. Remove target-chip state and `updateTarget()`. `renderExams()` maps `context.content.exams` to numbered cards and derives Start, Resume, last score, and Mastered state from local state. It must not render or link to any external practice exam.

- [ ] **Step 4: Run navigation and catalog tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: the three-nav and five-card assertions pass.

- [ ] **Step 5: Commit the new public structure**

```bash
git add src/ui/exams.ts src/ui/shell.ts src/ui/types.ts src/main.ts tests/app.test.ts
git commit -m "feat: add numbered exam catalog"
```

### Task 4: Ten-Question Exam Pages

**Files:**
- Rewrite: `src/ui/practice.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `InProgressExam.page`, `questionIds`, and `answers`
- Produces: actions `previous-page`, `next-page`, `submit-exam`, `confirm-submit`, and `cancel-submit`
- Produces: answer controls with `data-question-id` so one page can edit ten question cards

- [ ] **Step 1: Add multi-question page tests**

```ts
it("renders no more than ten questions and uses the requested bottom progress copy", async () => {
  startExamOne();
  expect(root.querySelectorAll(".question-card")).toHaveLength(10);
  expect(root.textContent).not.toContain("Question 1 of 65");
  expect(root.textContent).toContain("Practice Exam 1: 0 of 65 answered");
  click('[data-action="next-page"]');
  expect(root.querySelectorAll(".question-card")).toHaveLength(10);
});

it("renders five questions on page seven and restores browser-local answers", async () => {
  resumeExamOneAtPageSeven();
  expect(root.querySelectorAll(".question-card")).toHaveLength(5);
  expect(loadState(storage).state.inProgress?.page).toBe(6);
});
```

- [ ] **Step 2: Run focused app tests and confirm single-question rendering fails**

Run: `npm test -- --run tests/app.test.ts -t "renders no more than ten|renders five"`

Expected: FAIL because the old renderer uses `currentIndex`.

- [ ] **Step 3: Render and edit all questions on the active page**

Use:

```ts
export const QUESTIONS_PER_PAGE = 10;
export function pageQuestionIds(ids: string[], page: number): string[] {
  const start = page * QUESTIONS_PER_PAGE;
  return ids.slice(start, start + QUESTIONS_PER_PAGE);
}
```

Change answer handlers to resolve the question from `data-question-id` instead of one global current question. Keep ordering focus restoration, matching controls, immediate save, hidden answers, incomplete-submit confirmation, and accessible fieldsets.

- [ ] **Step 4: Run all app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: PASS for start, resume, four formats, pagination, focus, and submission confirmation.

- [ ] **Step 5: Commit the paginated exam experience**

```bash
git add src/ui/practice.ts src/main.ts src/styles.css tests/app.test.ts
git commit -m "feat: paginate practice exams by ten"
```

### Task 5: Wrong-Only Results and Retry-to-Mastery

**Files:**
- Rewrite: `src/ui/results.ts`
- Modify: `src/main.ts`
- Modify: `src/domain/error-report.ts`
- Modify: `src/styles.css`
- Test: `tests/app.test.ts`
- Test: `tests/error-report.test.ts`

**Interfaces:**
- Produces: `submitRound()` that appends every answer attempt and every incorrect attempt
- Produces: `continue-practice` action that starts only the current wrong IDs
- Produces: an original exam result that remains unchanged during retry rounds

- [ ] **Step 1: Write results and retry tests**

```ts
it("reviews wrong answers only with collapsed proof details", async () => {
  submitFixtureExamWithOneCorrectAndOneWrong();
  expect(root.querySelectorAll(".review-card")).toHaveLength(1);
  expect(root.querySelector(".review-card details")?.hasAttribute("open")).toBe(false);
  expect(root.textContent).toContain("Your answer");
  expect(root.textContent).toContain("Correct answer");
});

it("retries only wrong answers until the queue is empty without replacing the original score", async () => {
  submitFixtureExamWithTwoWrong();
  const original = loadState(storage).state.examResults["1"];
  click('[data-action="continue-practice"]');
  expect(loadState(storage).state.inProgress?.questionIds).toHaveLength(2);
  submitRetryWithOneWrong();
  click('[data-action="continue-practice"]');
  expect(loadState(storage).state.inProgress?.questionIds).toHaveLength(1);
  submitPerfectRetry();
  expect(loadState(storage).state.examResults["1"]).toMatchObject({
    score: original.score,
    mastered: true
  });
});
```

- [ ] **Step 2: Run results tests and confirm all-answer review fails**

Run: `npm test -- --run tests/app.test.ts tests/error-report.test.ts`

Expected: FAIL because the old results renderer reviews every question and has no retry queue.

- [ ] **Step 3: Implement original scoring, mastery queues, and collapsed review**

On an initial submit, save the score and wrong IDs under the exam result. On a retry submit, replace the mastery queue with only that round's wrong IDs. Render only wrong question cards. Put explanation, distractor notes, official proof, and video provenance inside one closed `<details>`. Show Continue practice only while the queue is non-empty; show Mastered and next-exam actions when empty.

- [ ] **Step 4: Preserve repeated incorrect attempts in TXT output**

Keep one section per incorrect attempt, in timestamp order, including question, user answer, correct answer, explanation, and all official verification URLs. Add exam ID and round ID when present.

- [ ] **Step 5: Run focused results and report tests**

Run: `npm test -- --run tests/app.test.ts tests/error-report.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit iterative retry**

```bash
git add src/ui/results.ts src/main.ts src/domain/error-report.ts src/styles.css tests/app.test.ts tests/error-report.test.ts
git commit -m "feat: retry wrong answers until mastered"
```

### Task 6: Question-Governance Library

**Files:**
- Rewrite: `src/ui/library.ts`
- Modify: `src/ui/types.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `AppContent.reviews` joined to `Question` by `questionId`
- Produces: filters `status`, `domain`, `type`, `source`, and `search`
- Produces: action `show-more-library` in increments of 25

- [ ] **Step 1: Write Library status, proof, and filtering tests**

```ts
it("shows governance counts and the corrected conflict with proof", async () => {
  app.navigate("library");
  expect(root.textContent).toContain("267 Verified");
  expect(root.textContent).toContain("0 Unverified");
  expect(root.textContent).toContain("1 Conflicted");
  filterLibrary("status", "conflicted");
  expect(root.textContent).toContain("SSE-S3");
  expect(root.querySelector('a[href*="docs.aws.amazon.com"]')).not.toBeNull();
});

it("labels unverified choices as Proposed answer and incrementally reveals cards", async () => {
  const unverifiedContent = withOneUnverifiedQuestion(content);
  app = await bootApp(root, { content: unverifiedContent, storage });
  app.navigate("library");
  filterLibrary("status", "unverified");
  expect(root.textContent).toContain("Proposed answer");
  expect(root.querySelectorAll(".library-question-card").length).toBeLessThanOrEqual(25);
});
```

- [ ] **Step 2: Run the Library tests and confirm launcher UI fails**

Run: `npm test -- --run tests/app.test.ts -t "governance|unverified"`

Expected: FAIL because Library is still a mock/source launcher.

- [ ] **Step 3: Implement joined dashboard cards and filters**

Render three count cards. Join every review record to its question. Verified cards show Correct answer and official proof. Unverified cards show Proposed answer plus the missing-proof reason. Conflicted cards show source claim, corrected answer, reason, source URLs, and official proof. Apply text search to prompt, task, concepts, and services; reset visible count to 25 whenever a filter changes.

- [ ] **Step 4: Run Library tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: PASS for counts, filters, labels, conflict evidence, and incremental rendering.

- [ ] **Step 5: Commit the Library dashboard**

```bash
git add src/ui/library.ts src/ui/types.ts src/main.ts src/styles.css tests/app.test.ts
git commit -m "feat: add question review dashboard"
```

### Task 7: Fixed-Then-Personalized Cheat Sheet

**Files:**
- Rewrite: `src/ui/cheatsheet.ts`
- Modify: `src/styles.css`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: checked-in Cheat Sheet order as the fixed baseline
- Consumes: incorrect attempts matched through question concepts
- Produces: `orderedCheatSheetEntries(context)` with stable local promotion

- [ ] **Step 1: Write baseline and local-promotion tests**

```ts
it("keeps checked-in First 20 Hours order before any attempts", async () => {
  app.navigate("cheatsheet");
  expect(cheatTitles(root)).toEqual(content.cheatSheet.map((entry) => entry.title));
});

it("promotes cards connected to locally missed concepts", async () => {
  saveState(storage, stateWithWrongAttempt("fixture-mc"));
  app = await bootApp(root, { content, storage });
  app.navigate("cheatsheet");
  expect(firstCheatConcepts(root)).toContain("fixture-concept");
});
```

- [ ] **Step 2: Run Cheat Sheet tests and confirm mastery-based order fails**

Run: `npm test -- --run tests/app.test.ts -t "First 20 Hours|promotes cards"`

Expected: FAIL because the old renderer sorts by removed mastery records.

- [ ] **Step 3: Implement error-count promotion with stable baseline ties**

Build a `wrongCountByConcept` map from local incorrect attempts and question concepts. Sort entries by descending wrong-concept count, then by original checked-in array index. Replace percentage mastery labels with `First 20 Hours · Step N` before errors and `Review priority` after promotion. Keep domain filter, download, print, memory hooks, facts, warnings, and AWS source links.

- [ ] **Step 4: Run app tests**

Run: `npm test -- --run tests/app.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Cheat Sheet ordering**

```bash
git add src/ui/cheatsheet.ts src/styles.css tests/app.test.ts
git commit -m "feat: prioritize cheat sheet from local errors"
```

### Task 8: Remove Planner Files, Polish, and Full Verification

**Files:**
- Delete: `src/ui/home.ts`
- Delete: `src/ui/settings.ts`
- Delete: `src/domain/date.ts`
- Delete: `src/domain/mastery.ts`
- Delete: `src/domain/selector.ts`
- Delete: `tests/date.test.ts`
- Delete: `tests/mastery.test.ts`
- Delete: `tests/selector.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `README.md`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: all interfaces finalized in Tasks 1–7
- Produces: a static production build with only the three requested public surfaces

- [ ] **Step 1: Add regression assertions for removed capabilities**

```ts
it("contains no removed planner or official-card copy", async () => {
  expect(root.textContent).not.toMatch(
    /target date|today's questions|daily plan|settings|source group|official practice exam/i
  );
  expect([...root.querySelectorAll(".bottom-nav a")]).toHaveLength(3);
});
```

- [ ] **Step 2: Delete obsolete modules and imports**

Remove the listed files, remove their imports and action branches from `src/main.ts`, and remove planner-only CSS selectors. Keep the app's recovery behavior internal; do not create a fourth navigation destination.

- [ ] **Step 3: Finish mobile-first styles and documentation**

Ensure all tap targets are at least 44px, the bottom exam controls remain visible above the three-item navigation, ten question cards flow in one column on phones, review details are collapsed, and Library filters remain readable at 320px. Update README routes, static deployment, browser-only persistence, five-exam policy, retry behavior, and content review statuses.

- [ ] **Step 4: Run the full automated gate**

Run: `npm run check`

Expected: content validation, all Vitest tests, TypeScript, and Vite production build pass.

- [ ] **Step 5: Browser-verify the live Vite app**

At `http://127.0.0.1:5173/`, verify:

1. Bottom nav contains only the three requested labels.
2. The catalog has five local exams and no AWS official card.
3. Exam 1 renders 10 questions on page 1 and five on page 7.
4. Answers survive reload.
5. Submit shows only wrong review cards with closed details.
6. Continue practice shrinks the wrong queue.
7. Library shows 267/0/1 counts and official proof on the conflict.
8. Cheat Sheet has fixed initial order and promotes weak concepts after an error.
9. No target, planner, timer, Settings, login, or backend UI remains.

- [ ] **Step 6: Inspect the final diff and commit cleanup**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intentional changes.

```bash
git add -A
git commit -m "refactor: remove learning planner surfaces"
```

- [ ] **Step 7: Push the tested branch to public GitHub**

Run: `git push origin HEAD:main`

Expected: `main` on `christiannp/AWS-AI-Practitioner-Practice-Exams` advances to the verified local commit.
