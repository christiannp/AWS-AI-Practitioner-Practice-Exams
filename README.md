# AWS AI Practitioner Practice Exams

A mobile-first, static study app for the AWS Certified AI Practitioner
(AIF-C01) exam. It is built for focused commute practice and stores each
person's progress only in that browser.

## App structure

The bottom navigation has three destinations:

- **Practice Exams** — five numbered, untimed 65-question exams.
- **Cheat Sheet** — 20 official-AWS-backed memory cards ordered with *The First
  20 Hours* high-leverage-first technique. Local mistakes promote related
  cards.
- **Library** — a governance dashboard for all questions, answers, review
  status, proof, and source provenance.

There is no login, target date, learning plan, timer, Settings screen, backend,
VPS storage, or external official-practice-exam card.

## Practice behavior

- Exams 1–4 contain 260 distinct Verified questions.
- Exam 5 contains the remaining seven Verified questions plus 58 fixed,
  domain-weighted repeats. No question repeats inside one exam.
- Each page shows at most 10 complete questions; page seven shows five.
- Multiple choice, multiple response, ordering, and matching are supported.
- Answers and explanations remain hidden until submission.
- Results show statistics and wrong answers only.
- **Continue practice** retries only the wrong-answer queue. The queue keeps
  shrinking until every answer is correct.
- Retry rounds never overwrite the original 65-question score.
- Every incorrect attempt is logged and included in the detailed TXT report.

## Content and verification

The bank contains 268 original questions with no exact duplicate prompts:

- 267 **Verified** — the app answer is supported by linked official AWS
  documentation and is eligible for practice exams.
- 0 **Unverified** — no current question lacks authoritative proof.
- 1 **Conflicted** — the source answer for SSE-S3 object access was corrected
  using official AWS proof and remains Library-only.

The unchanged 680-item audit of both supplied YouTube playlists is retained and
mapped to the consolidated bank. The freeCodeCamp/ExamPro course audit is
informational syllabus evidence only. Official AWS documentation remains the
answer authority. ExamTopics is not included.

The source-answer correction is documented in
[`source-answer-corrections.txt`](source-answer-corrections.txt).

## Run locally

Requirements: a current Node.js release and npm.

```bash
npm ci
npm run check
npm run dev
```

Open the URL printed by Vite. Progress is stored under the
`aws-aif-study-state` browser local-storage key.

## Quality gate

```bash
npm run check
```

This command:

1. validates question content, proof URLs, review statuses, source mappings,
   fingerprints, correction records, and all five exam manifests;
2. runs the content, scoring, persistence, error-report, and mobile-flow tests;
3. type-checks the TypeScript; and
4. builds the static production app in `dist/`.

Important checked-in data:

- `public/data/questions.json` — the consolidated question bank;
- `public/data/practice-exams.json` — stable membership for Exams 1–5;
- `public/data/question-reviews.json` — Verified, Unverified, and Conflicted
  decisions with reasons and proof;
- `public/data/source-videos.json` — both supplied playlist catalogs;
- `public/data/source-audit.json` — all 680 source-question dispositions;
- `public/data/source-materials.json` — the course knowledge audit; and
- `public/data/cheat-sheet.json` — the commuter memory deck.

## Deploy to a VPS

Build and copy the static output:

```bash
npm ci
npm run check
rsync -av --delete dist/ user@your-vps:/var/www/aws-aif-study/
```

Any static HTTP server can serve `dist/`. Hash routes avoid server-side route
fallback rules, and relative asset paths support a domain root or subdirectory.

Minimal Nginx location:

```nginx
location /aws-aif-study/ {
    alias /var/www/aws-aif-study/;
    index index.html;
}
```

The VPS receives only static files. Learner answers, scores, retry queues, and
error history stay in each visitor's browser.

## Local-data behavior

- Progress does not sync between browsers or devices.
- Reloading or closing the page preserves an unfinished exam and its answers.
- Clearing site data removes that browser's progress.
- Corrupt or incompatible saved data is isolated so the app can start safely.
- Version-1 planner state migrates compatible attempt history and drops target,
  mastery-schedule, and daily-plan fields.

## Updating generated content

Normal app development and deployment use the checked-in JSON files. To rebuild
the exam and review manifests after editing the question bank:

```bash
node scripts/build-practice-exams.mjs
npm run check
```

The source-audit and question-generation scripts remain under `scripts/`.
Caption and video working files stay in the ignored `.source-cache/` directory
and are not required to build or deploy the app.
