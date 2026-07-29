# AWS AI Practitioner Practice Exams

A mobile-first, device-local study app for the AWS Certified AI Practitioner
(AIF-C01) exam. It is designed for one-hour commute sessions and uses the
rapid-skill-acquisition ideas from *The First 20 Hours*: deconstruct the exam,
practice the weakest subskills, get immediate feedback after a focused group,
and revisit errors on a widening schedule.

## What is included

- 268 original, verified practice questions.
- The complete, unchanged 680-item audit of the two supplied YouTube playlists
  is represented in the source audit and mapped to the consolidated bank.
- No exact duplicate practice prompts.
- Multiple choice, multiple response, ordering, and matching formats.
- Current AIF-C01 coverage as of July 29, 2026, including agentic AI, MCP,
  context engineering, Amazon Quick, Kiro, Strands Agents, and Amazon Bedrock
  AgentCore.
- Adaptive 25-question daily groups: 13 weak items, 7 unseen items, and 5 due
  reviews when those pools are available.
- Balanced first-session diagnostic and untimed 65-question mixed mocks. They
  reflect the current 90-minute exam format without imposing an in-app timer.
- Answers and explanations appear only after the whole group is submitted.
- Every attempt is saved locally; incorrect attempts remain available through
  the Library's **Errors logged** filter.
- A 20-card, weak-first memory sheet with TXT download and print support.
- Editable exam date, initially August 31, 2026.
- JSON progress backup/import and confirmed device-local reset.
- English-only prompts and explanations, with no account, backend, credential,
  telemetry, or timer.
- One confirmed source-answer correction in
  [`source-answer-corrections.txt`](source-answer-corrections.txt).

## Run locally

Requirements: a current Node.js release and npm.

```bash
npm ci
npm run check
npm run dev
```

Open the URL printed by Vite. Progress is stored in the current browser under
the `aws-aif-study-state` local-storage key.

## Quality gate

```bash
npm run check
```

This command:

1. validates every question, verification URL, source mapping, fingerprint,
   interaction format, and correction-report contract;
2. runs the unit and mobile-flow test suite; and
3. type-checks and creates the production output in `dist/`.

The source inventory is in:

- `public/data/source-videos.json` — the two playlist catalogs;
- `public/data/source-audit.json` — all 680 source-question dispositions;
- `public/data/questions.json` — the verified, consolidated practice bank; and
- `public/data/cheat-sheet.json` — the commuter memory deck.

## Course-only knowledge audit

The 16-chapter freeCodeCamp/ExamPro course knowledge audit is retained as
informational syllabus evidence only. Official AWS documentation is the only
answer authority: video prompts are coverage references, rewritten in original
wording, and corrected when necessary.

The audit rejects obsolete beta claims that the exam lasts 120 minutes or uses
case studies. The current mechanics are 65 questions in 90 minutes, using
multiple-choice, multiple-response, ordering, and matching interactions.

AWS Lake Formation was the explicit verified gap discovered in the course
review and was added to both the question bank and memory deck using official
AWS documentation. ExamTopics is not included.

## Deploy to a VPS

Build and copy the static output:

```bash
npm ci
npm run check
rsync -av --delete dist/ user@your-vps:/var/www/aws-aif-study/
```

Any static HTTP server can serve `dist/`. The app uses hash routes, so it does
not require server-side route fallback rules. Its asset and data paths are
relative, so it can be hosted at a domain root or a subdirectory.

Minimal Nginx location:

```nginx
location /aws-aif-study/ {
    alias /var/www/aws-aif-study/;
    index index.html;
}
```

Serve it over HTTPS when practical. Although the app has no credentials,
HTTPS avoids browser restrictions and protects downloaded/imported progress
while in transit.

## Local-data behavior

- Progress does not sync between browsers or devices.
- Clearing site data removes progress.
- Use **Settings → Export progress** before changing phones, browsers, or VPS
  domains.
- Import validates the backup before asking to replace the current state.
- Reset removes only this app's local-storage key.

## Updating the content bank

The checked-in JSON files are ready to serve. The scripts under `scripts/`
document the reproducible source-audit and generation pipeline. Caption and
video working files remain in the ignored `.source-cache/` directory and are
not required to build or deploy the app.

After changing questions or the catalog, run:

```bash
node scripts/build-question-bank.mjs
npm run check
```

The generator requires the local source draft cache used during the audit.
Normal app development and deployment do not.
