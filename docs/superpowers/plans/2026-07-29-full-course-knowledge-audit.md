# Full-Course Knowledge Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cancelled ExamTopics work, audit all 16 chapters of the supplied full course, add only current verified knowledge gaps, and publish the reviewed study app.

**Architecture:** Restore the original YouTube-only provenance pipeline, then add a small informational-source manifest validated alongside the existing static content. Represent course-discovered gaps as official additions with original wording and AWS verification; keep the app itself backend-free and unchanged except for the strengthened bank and cheat sheet.

**Tech Stack:** Node.js ESM scripts, TypeScript 5.9, Vite 7, Vitest 3, jsdom, JSON static assets, vanilla HTML/CSS/TypeScript

## Global Constraints

- English only.
- ExamTopics is excluded completely; no parser, dependency, cache, data,
  provenance, answer, community vote, filter, or audit record may remain.
- Retain all 680 existing YouTube practice-question audit records.
- Treat the full course as an informational syllabus, not an answer authority
  or practice-question source.
- Do not commit or ship the course transcript.
- Verify every added fact and answer against current official AWS material.
- Keep original question wording and unique normalized prompts/fingerprints.
- Preserve multiple choice, multiple response, ordering, and matching only.
- Preserve device-local progress, adaptive 25-question groups, untimed
  65-question mocks, post-submit explanations, and the August 31, 2026 default.
- Preserve the current official 65-question, 90-minute exam mechanics.
- Publish only after focused task reviews and the broad whole-branch review.

---

### Task 1: Remove Cancelled ExamTopics Scaffolding

**Files:**
- Remove through revert: `scripts/source-audit.mjs`
- Remove through revert: `scripts/source-audit.d.mts`
- Remove through revert: `scripts/examtopics-source.mjs`
- Remove through revert: `scripts/examtopics-source.d.mts`
- Remove through revert: `tests/source-audit.test.ts`
- Remove through revert: `tests/examtopics-source.test.ts`
- Remove through revert: `tests/fixtures/examtopics-page.html`
- Restore: `src/data/types.ts`
- Restore: `src/domain/selector.ts`
- Restore: `src/ui/library.ts`
- Restore: `tests/fixtures/questions.json`
- Restore: `tests/selector.test.ts`
- Restore: `package.json`
- Restore: `package-lock.json`

**Interfaces:**
- Consumes: Commits `4e412c8` and `852be8b`.
- Produces: The clean pre-ExamTopics application state while retaining later
  planning documents and the user's full-course scope.

- [ ] **Step 1: Verify the two cancelled commits are the current implementation delta**

Run:

```bash
git log --oneline -5
git show --stat --oneline 852be8b
git show --stat --oneline 4e412c8
```

Expected: the commits contain only mixed-source/ExamTopics scaffolding.

- [ ] **Step 2: Revert the parser commit**

Run:

```bash
git revert --no-edit 4e412c8
```

Expected: Cheerio, parser files, parser fixture, and parser tests are removed.

- [ ] **Step 3: Revert the mixed-provenance commit**

Run:

```bash
git revert --no-edit 852be8b
```

Expected: the original YouTube `SourceRef` and video-source selectors return.

- [ ] **Step 4: Assert complete ExamTopics removal**

Run:

```bash
rg -n -i 'examtopics|cheerio' package.json package-lock.json scripts src tests public README.md || true
```

Expected: no matches.

- [ ] **Step 5: Run the restored quality gate**

Run:

```bash
npm install
npm run check
git diff --check
```

Expected: 680 source records, all tests pass, and the production build passes.

- [ ] **Step 6: Report the two generated revert commits**

Do not squash the reverts. Their history documents why the cancelled source
work was removed.

---

### Task 2: Course Manifest, Lake Formation Question, and Memory Note

**Files:**
- Create: `public/data/source-materials.json`
- Modify: `scripts/question-catalog.mjs`
- Modify: `scripts/build-question-bank.mjs`
- Modify: `public/data/questions.json`
- Modify: `public/data/cheat-sheet.json`
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Consumes: Current AIF-C01 exam guide, revisions, in-scope list, official AWS
  product documentation, and the 16 supplied course chapter timestamps.
- Produces: One informational material record, `aws-lake-formation` concept,
  original generated practice questions, and `d5-data-governance-services`
  memory card.

- [ ] **Step 1: Write failing course-manifest tests**

Add:

```ts
import materials from "../public/data/source-materials.json";

it("classifies all 16 supplied course chapters", () => {
  const course = materials.find(
    (item) => item.id === "youtube:WZeZZ8_W-M4"
  );
  expect(course?.durationSeconds).toBe(53928);
  expect(course?.chapters).toHaveLength(16);
  expect(
    course?.chapters.every((chapter) =>
      ["covered", "gap", "out-of-scope", "outdated"].includes(
        chapter.coverage
      )
    )
  ).toBe(true);
});

it("rejects beta-era duration and case-study claims", () => {
  const course = materials.find(
    (item) => item.id === "youtube:WZeZZ8_W-M4"
  );
  expect(course?.rejectedClaims).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        claim: "The exam duration is 120 minutes.",
        currentRule: "The current exam duration is 90 minutes."
      }),
      expect.objectContaining({
        claim: "Case studies are an exam interaction format.",
        currentRule:
          "The current guide lists multiple choice, multiple response, ordering, and matching."
      })
    ])
  );
});

it("teaches the Lake Formation gap in the bank and cheat sheet", () => {
  expect(
    questions.some((question) =>
      question.concepts.includes("aws-lake-formation")
    )
  ).toBe(true);
  expect(
    cheatSheet.some((entry) =>
      entry.concepts.includes("aws-lake-formation")
    )
  ).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- --run tests/content.test.ts
```

Expected: FAIL because `source-materials.json` is missing.

- [ ] **Step 3: Add all chapter metadata**

Use these exact chapter starts in seconds:

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

Every chapter gets `domains`, `tasks`, `concepts`, `coverage`, `reason`, and
official `verification` URLs. Mark PartyRock and Athena `out-of-scope`; mark
Introduction `outdated` because of beta mechanics; mark Lake Formation `gap`;
classify the other chapters from current bank coverage.

- [ ] **Step 4: Add the verified Lake Formation concept**

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

The generator produces original official-addition scenario and definition
questions from this concept with no course provenance.

- [ ] **Step 5: Add the memory card**

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

- [ ] **Step 6: Validate the manifest and gap contract**

Extend `validate-content.mjs` to require:

- One `youtube:WZeZZ8_W-M4` material with exactly 16 increasing chapter
  timestamps.
- Valid coverage, reason, and HTTPS verification on every chapter.
- Both rejected beta claims and current replacements.
- Every `gap` concept in at least one question and one cheat-sheet card.
- No string matching `/examtopics/i` in loaded public data.

- [ ] **Step 7: Regenerate and run focused checks**

Run:

```bash
node scripts/build-question-bank.mjs
npm test -- --run tests/content.test.ts
node scripts/validate-content.mjs
```

Expected: PASS with two new Lake Formation questions and one new memory note.

- [ ] **Step 8: Commit the complete course audit**

```bash
git add public/data/source-materials.json public/data/questions.json public/data/cheat-sheet.json scripts/question-catalog.mjs scripts/build-question-bank.mjs scripts/validate-content.mjs tests/content.test.ts
git commit -m "content: audit full course and add Lake Formation gap"
```

---

### Task 3: Final Validation and Documentation

**Files:**
- Modify: `README.md`
- Modify: `tests/content.test.ts`
- Modify: `scripts/validate-content.mjs`

**Interfaces:**
- Consumes: Final bank, 680-record playlist audit, course manifest, cheat
  sheet, correction report, and application tests.
- Produces: Strict `npm run check` acceptance and an accurate VPS/GitHub
  handoff.

- [ ] **Step 1: Add final acceptance assertions**

Require:

```ts
expect(audit).toHaveLength(680);
expect(materials).toHaveLength(1);
expect(
  JSON.stringify({ questions, audit, cheatSheet, materials })
).not.toMatch(/examtopics/i);
expect(new Set(questions.map((question) => question.fingerprint)).size).toBe(
  questions.length
);
```

- [ ] **Step 2: Update the README**

Document:

- The final generated question count and memory-note count.
- The unchanged complete 680-item two-playlist audit.
- The 16-chapter freeCodeCamp/ExamPro knowledge audit.
- Official AWS documentation as the only answer authority.
- Rejection of outdated beta duration and case-study claims.
- Lake Formation as the explicit verified gap added from the course review.
- ExamTopics is not included.
- Existing local use, JSON backup, VPS build, and deployment commands.

- [ ] **Step 3: Run the complete committed-state quality gate**

Run:

```bash
npm run check
git diff --check
git status --short
```

Expected: content validation, all Vitest files, TypeScript, and Vite build pass;
only intended files are modified.

- [ ] **Step 4: Commit final documentation and validation**

```bash
git add README.md tests/content.test.ts scripts/validate-content.mjs
git commit -m "docs: finalize full-course audit handoff"
```

---

### Task 4: Publish the Reviewed Branch

Execute only after Tasks 1–3 pass focused reviews and the broad whole-branch
review passes.

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: Clean reviewed branch and public repository
  `christiannp/AWS-AI-Practitioner-Practice-Exams`.
- Produces: Public `main` branch with verified source and history.

- [ ] **Step 1: Re-run verification on exact HEAD**

```bash
npm run check
git status --short
git log -1 --oneline
```

- [ ] **Step 2: Confirm authentication and public visibility**

```bash
gh auth status
gh repo view christiannp/AWS-AI-Practitioner-Practice-Exams --json nameWithOwner,visibility,url
```

Expected: authenticated as `christiannp` and `visibility` is `PUBLIC`.

- [ ] **Step 3: Configure the exact remote**

```bash
git remote add origin https://github.com/christiannp/AWS-AI-Practitioner-Practice-Exams.git
```

If `origin` already exists, require the same URL.

- [ ] **Step 4: Push reviewed history as main**

```bash
git push --set-upstream origin agent/aws-ai-practitioner-app:main
```

- [ ] **Step 5: Verify publication**

```bash
git ls-remote origin refs/heads/main
gh api repos/christiannp/AWS-AI-Practitioner-Practice-Exams/contents/README.md --jq '.html_url'
```

Expected: remote `main` equals local HEAD and README exists publicly.
