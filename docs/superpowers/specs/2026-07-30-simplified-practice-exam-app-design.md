# Simplified Practice-Exam App — Design Specification

Date: 2026-07-30

## 1. Goal

Replace the current target-date and daily-learning-plan experience with a
focused, static, mobile-first practice application. The app has no login,
backend, VPS storage, timer, target date, or shared learner state.

The three bottom-navigation destinations are:

1. Practice Exams
2. Cheat Sheet
3. Library

Practice and result screens are internal exam-flow routes and do not add more
bottom-navigation items.

## 2. Product Scope

Remove:

- Today/home learning-plan dashboard
- Target date and all countdown UI
- First-20-session route/progress display
- Daily adaptive group
- Source-video practice launches
- Settings screen, JSON backup/import, and reset UI
- The official AWS practice-exam card

Retain:

- English-only verified questions and all four supported interaction formats
- Answers and explanations only after submission
- Device-local browser persistence
- Wrong-answer history and detailed TXT export
- Current official AWS verification links
- Static VPS deployment with no credentials or backend

## 3. Practice-Exam Catalog

Add a checked-in `public/data/practice-exams.json` manifest. Each local exam has
a stable numeric ID, title, version, and exactly 65 question IDs.

Only questions classified as `verified` are eligible. The current bank has 268
questions, including one source conflict:
`aif-d5-sse-s3-object-access-scenario`. That conflicted item is Library-only,
leaving 267 verified exam-eligible questions.

The fixed distribution is:

- Practice Exams 1–4: 65 distinct verified questions each.
- Practice Exam 5: the remaining 7 verified questions plus 58 fixed repeats.

The 58 repeats are deterministic and selected to approximate the current AWS
domain weights while preserving a useful difficulty mix. No question repeats
within one exam. The generated manifest is checked in so exam contents and
saved progress remain stable across deployments.

The catalog screen shows five numbered cards with question count, last score,
completion state, and Start or Resume. There is no external official-exam card.

## 4. Exam Flow

An exam shows at most 10 complete question cards per page:

- Pages 1–6: 10 questions each
- Page 7: 5 questions

The existing top-level “Question 1 of 65” treatment is removed. The quiet exam
header names only the selected exam and current page. A sticky bottom control
bar displays:

`Practice Exam 1: X of 65 answered`

It also contains Previous, Next, and Submit controls. Answers persist
immediately in local browser storage. Reloading or closing the browser resumes
the same page and answers. Submitting with unanswered questions requires an
explicit confirmation; unanswered questions score as incorrect.

## 5. Results and Iterative Retry

After submission, the result screen shows:

- Percentage and correct/incorrect counts
- A compact domain breakdown
- Review and Continue practice actions
- Review cards for wrong answers only

Each wrong-answer card shows the question, the learner answer, and the correct
answer. A collapsed details section contains the explanation, distractor
reasons when applicable, official AWS verification links, and source-video
links as provenance.

Continue practice starts a retry round containing only the wrong questions.
Retry rounds use the same maximum of 10 questions per page. This loop continues
until every question in the retry round is answered correctly. The original
65-question score remains the exam's reported score; retry rounds shrink a
separate mastery queue and never rewrite that score. Clearing the queue marks
the numbered exam mastered and offers Return to exams and Start next exam.

The detailed wrong-answer TXT export remains available from results and
Library. It includes repeated incorrect attempts and all existing proof fields.

## 6. Question Review Status

Every question receives one review status:

- `verified`: the answer is supported by an approved official AWS source.
- `unverified`: no authoritative AWS proof could be established. The record
  stays visible in Library with a short reason but is excluded from exams.
- `conflicted`: a practice source answer conflicts with official AWS proof.
  Library shows the corrected AWS-backed answer, the short conflict
  explanation, source URL, and official proof. It is excluded from exams.

The current bank begins with 267 Verified, 0 Unverified, and 1 Conflicted.
Status, reason, and proof are generated and validated as content data rather
than inferred from learner history.

## 7. Library Dashboard

Library is the content-governance dashboard, not an exam launcher. Its summary
shows counts for Verified, Unverified, and Conflicted. Filters cover:

- Review status
- Domain
- Question format
- Source video
- Text search

Every result card displays the full question. Verified cards display the
correct answer and official proof links. Unverified cards label the current
choice as a Proposed answer and explain briefly why proof is missing. Conflicted
cards show the source claim, corrected answer, conflict reason, source link, and
official proof.

The dashboard is paginated or incrementally revealed so it never renders all
question details at once on a phone.

## 8. Cheat Sheet

Cheat Sheet remains grounded in the current official AWS exam guide and
approved AWS documentation.

The initial order is identical for everyone and applies the *First 20 Hours*
principles:

1. High-leverage prerequisite distinctions
2. Higher-weight exam-domain decisions
3. Commonly confused AWS services and terms
4. Lower-leverage details

All cards remain available. After the browser has local attempt history, cards
connected to wrong answers are promoted ahead of their fixed baseline position.
The browser personalization never changes shared files or VPS data.

Each card retains its memory hook, facts, confusion warning, and official AWS
source. Domain filtering, text download, and print remain.

## 9. Local State

Replace the learning-plan-oriented state with version 2:

- Attempts by question ID
- Per-exam last score and completion state
- One in-progress exam or retry round
- Answers, current page, and retry question IDs
- Wrong-answer history

The target setting, mastery schedule, due dates, session target, and daily mode
are removed. A migration preserves compatible v1 attempt history but discards
obsolete target and daily-plan fields. Corrupt-state recovery remains
non-destructive.

## 10. Code and File Simplification

Delete modules that exist only for removed capabilities, including the current
home, settings, target-date, mastery-schedule, and adaptive-selector surfaces.
Rewrite the shell, route types, practice renderer, results renderer, Library,
and application controller around the fixed exam manifest.

Remove obsolete tests and replace them with focused coverage for:

- Exact five-exam manifest and 65-question contracts
- Verified-only exam membership
- Stable repeated-question policy
- Ten-question pagination
- Resume and local persistence
- Submit confirmation and exact scoring
- Wrong-only retry until perfect
- Collapsed proof details
- Library status classification and filtering
- Fixed-then-local Cheat Sheet ordering
- Three-item bottom navigation and removed target UI

## 11. Validation and Success Criteria

The update is complete when:

1. Only Practice Exams, Cheat Sheet, and Library appear in bottom navigation.
2. No target-date, daily-plan, source-group, Settings, or official-exam-card UI
   remains.
3. Five stable 65-question exams load from the checked-in manifest.
4. Every exam question is Verified; Unverified and Conflicted records are
   Library-only.
5. Each exam page renders no more than 10 questions.
6. The bottom progress copy follows the requested exam format.
7. Results show wrong answers only and retry them until perfect.
8. Review details contain explanations and proof links.
9. All persistence is browser-local and the VPS remains static.
10. Content validation, automated tests, TypeScript, production build, mobile
    browser verification, independent review, and GitHub push all pass.
