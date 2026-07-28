# AWS AI Practitioner Study App — Design Specification

Date: 2026-07-29

## 1. Goal

Build an English-only, mobile-first static HTML application that helps an AI engineer who is new to AWS prepare for the AWS Certified AI Practitioner (AIF-C01) exam. The learner plans to study for one hour per day, primarily while commuting, with an editable target exam date initially set to August 31, 2026.

The application will turn practice questions from two supplied YouTube playlists into a verified, deduplicated question bank, add original questions where the current exam format or objectives are underrepresented, and organize daily study using principles from Josh Kaufman's *The First 20 Hours*.

Supplied sources:

- https://www.youtube.com/playlist?list=PLwRKAmP13yer3GDXZlAXt20u7qp9U6fBf
- https://www.youtube.com/playlist?list=PLMdFrZK3uZdev_uAoHZj-6lO55erQ6zd_

## 2. Success Criteria

The finished application must:

1. Run as static files suitable for deployment on the learner's own VPS.
2. Work well on a phone and require no account, credentials, backend, or timer.
3. Create a 25-question daily group and hide answers until the entire group is submitted.
4. Track attempts, progress, mastery, the target date, and study history in device-local browser storage.
5. Provide JSON backup, restore, and progress-reset controls.
6. Support multiple-choice, multiple-response, ordering, and matching questions.
7. Include every discernible question from both supplied playlists, subject to deduplication and quality correction.
8. Avoid exact duplicate questions and consolidate semantically equivalent questions while preserving all source references.
9. Verify every correct answer against current authoritative material, preferring official AWS sources.
10. Provide explanations, distractor reasoning where applicable, and verification links after submission.
11. Include a concise, downloadable cheat sheet organized by exam domain and personalized to weak areas.
12. Include a plain-text report of errors found in the source videos.
13. Provide untimed 65-question mixed mock exams and access to source-based question groups.

## 3. Learning Model

### 3.1 First 20 Hours adaptation

The first 20 completed one-hour sessions form a rapid-acquisition phase:

1. Deconstruct AIF-C01 into its five official domains and their task-level subskills.
2. Establish a baseline with a balanced diagnostic group.
3. Prioritize the learner's AWS-specific gaps while retaining coverage of general AI concepts.
4. Provide enough post-submission explanation to support intelligent self-correction.
5. Remove practice barriers with a single primary daily action, local persistence, and phone-first interaction.
6. Accumulate 20 focused sessions, after which the application continues with mixed mastery maintenance until the target date.

The official domain weights are:

- Domain 1 — Fundamentals of AI and ML: 20%
- Domain 2 — Fundamentals of Generative AI: 24%
- Domain 3 — Applications of Foundation Models: 28%
- Domain 4 — Guidelines for Responsible AI: 14%
- Domain 5 — Security, Compliance, and Governance for AI Solutions: 14%

Reference: https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html

### 3.2 Daily group construction

The first daily group is a balanced diagnostic that approximates the official domain weights and includes AWS-service-specific questions.

After the diagnostic, each 25-question daily group targets:

- 50% weak or previously missed concepts
- 30% unseen questions
- 20% spaced review of previously correct concepts

Integer rounding may alter these proportions by one question. Selection must:

- Prefer questions whose concepts are weakest or due for review.
- Avoid repeating the same question within a group.
- Avoid presenting semantically equivalent questions in the same group.
- Maintain broad domain coverage rather than allowing one weak domain to consume the entire group.
- Fall back gracefully when a category has fewer eligible questions, filling the group from the next most valuable category.

A concept's mastery is calculated from correctness, number of attempts, recency, and repeated errors. A correct first attempt increases mastery; an incorrect attempt lowers it and schedules earlier review. Repeated correct answers spaced across sessions increase the review interval.

### 3.3 Submission and review

The learner can edit answers until choosing **Submit group**. Before submission, the application shows no correctness indicators or explanations.

After submission, the application displays:

- Overall score and domain breakdown
- Correct answer for each question
- Concise explanation
- Why each distractor is wrong for choice-based questions
- Official verification source links
- Updated mastery and recommended weak concepts

Unanswered questions are scored as incorrect, matching the AWS exam guide.

## 4. Product Experience

### 4.1 Home

The home screen is centered on **Start today's 25 questions** and displays:

- Editable target date, initially August 31, 2026
- Days remaining
- Completed one-hour sessions and progress toward the first 20 hours
- Question-bank coverage
- Overall mastery
- Five-domain mastery summary
- Resume state when a group is in progress

### 4.2 Practice

The practice screen:

- Shows one question at a time with position and completion progress.
- Supports touch-friendly selection and keyboard access.
- Supports reorder controls for ordering questions.
- Supports an accessible prompt-to-answer assignment interface for matching questions.
- Allows forward and backward navigation without losing answers.
- Provides a question navigator showing answered and unanswered state only.
- Requires explicit confirmation before submission when any questions are unanswered.
- Has no timer.

### 4.3 Results

The results screen provides score, domain performance, question-by-question review, explanations, verification links, and a direct way to revisit the cheat sheet for weak concepts.

### 4.4 Question library

The library provides:

- All deduplicated questions
- Filters for domain, subskill, format, difficulty, source playlist, and unseen/incorrect/mastered state
- Source-group practice based on video parts
- Untimed 65-question mixed mock generation

Source-group practice uses the same submit-then-review behavior as daily practice.

### 4.5 Cheat sheet

The cheat sheet is concise and memorization-oriented. It includes:

- AWS service-to-use-case mappings
- Commonly confused services and concepts
- Foundation-model lifecycle and evaluation concepts
- Prompt engineering patterns
- Responsible AI principles
- Security, compliance, governance, IAM, and shared-responsibility essentials
- High-yield exam traps

Weak concepts are shown first when attempt history exists. The complete sheet remains browsable by domain and is downloadable or printable.

### 4.6 Settings and data controls

Settings provide:

- Editable exam target date
- JSON export and import
- Reset progress with explicit confirmation

All data stays on the current device. No account, telemetry, or remote persistence is required.

## 5. Question Bank and Provenance

### 5.1 Question schema

Each question record contains:

- Stable identifier
- Question format
- Original, clear prompt
- Response options or matching/ordering items
- Correct answer representation
- Explanation
- Distractor explanations where applicable
- Official exam domain and task-level subskill
- Difficulty
- Concepts and AWS services
- Source video identifiers, titles, URLs, question numbers, and/or timestamps
- Verification URLs and verification date
- Concept fingerprint for deduplication

### 5.2 Source processing

For each supplied video:

1. Identify every discernible practice question and the answer stated by the video.
2. Normalize the prompt and choices.
3. Compare normalized text and concept fingerprints against the existing bank.
4. Consolidate exact and semantic duplicates while attaching every relevant source reference.
5. Independently verify the answer.
6. Rewrite ambiguous, outdated, unclear, or overly source-specific wording into an original AIF-C01-style question.
7. Record source-answer errors in the corrections report.

Question coverage is measured by a source audit manifest so that every discernible source question is either represented by a bank entry or explicitly recorded as unusable with a reason.

### 5.3 Verification policy

Sources are prioritized in this order:

1. Current AWS Certification exam guide and official AWS documentation
2. Current official AWS Skill Builder exam-preparation material when publicly accessible
3. Current official AWS product documentation, FAQs, whitepapers, and service pages
4. Other primary authoritative documentation only when the question concerns a general AI concept not defined by AWS

No answer is accepted solely because a video marks it as correct. Every shipped question must have at least one verification URL, an explanation consistent with that source, and a recorded verification date.

If sources conflict:

- Prefer the most recent official AWS source that directly addresses the scenario.
- Rewrite the question to remove conditions that make the answer ambiguous.
- Exclude the question if one defensible answer still cannot be established.

### 5.4 Added questions

Original questions may be added to:

- Cover ordering and matching formats
- Address current objectives absent from the playlists
- Restore coverage lost when duplicate or invalid source questions are removed

Added questions follow the same verification and explanation requirements as source-derived questions.

## 6. Source Error Report

The project includes `source-answer-corrections.txt`. It documents errors found in the YouTube source material, not the learner's quiz mistakes.

Each entry contains:

- Playlist and video
- Source question number and/or timestamp
- Brief question description
- Answer stated by the source
- Corrected answer
- Concise reason for the correction
- Official verification URL
- Verification date

If no source-answer errors are found, the report explicitly states that no confirmed errors were found after verification.

## 7. Technical Design

The deliverable is a static, mobile-first web application composed of HTML, CSS, JavaScript, and static question-data assets. It can be copied to a VPS and served without application-server logic.

Logical modules have separate responsibilities:

- Question data and validation
- Deduplication and source audit
- Daily selection and mastery scheduling
- Scoring for four question formats
- Local persistence and backup/restore
- Practice and review UI
- Dashboard and progress summaries
- Cheat-sheet rendering

Browser storage contains only user state: settings, in-progress answers, attempts, mastery, and session history. Versioned data migrations preserve compatible progress when the static question bank is updated.

## 8. Error Handling

- Missing or malformed question records are rejected by pre-delivery validation and never shown.
- A corrupted browser-state record is preserved as a downloadable recovery payload when possible, then replaced with safe defaults after user confirmation.
- Import validates schema and version before replacing current progress.
- An interrupted practice session resumes from its last locally saved state.
- If fewer than 25 eligible questions exist for a requested filtered group, the UI states the available count instead of silently duplicating questions.
- Unavailable external verification links do not prevent local review; the explanation and stored URL remain visible.

## 9. Validation and Testing

Automated checks cover:

- Question schema and stable identifiers
- Exact duplicate and concept-fingerprint detection
- Complete source-audit accounting
- Correct-answer and verification-source presence
- Explanation and distractor-reason presence
- Scoring for multiple-choice, multiple-response, ordering, and matching
- Daily group composition, no within-group duplication, and fallbacks
- Mastery updates and spaced-review scheduling
- Local-state serialization, migration, backup, restore, and reset
- Target-date calculations

Product validation covers:

- Production build/loading
- Phone-sized layout and touch targets
- Keyboard navigation and visible focus
- Screen-reader labels and status announcements
- Practice persistence across reloads
- Submit-then-review behavior
- No timer and no answer leakage before submission

## 10. Out of Scope

- Accounts, authentication, authorization, or security controls for user data
- Cross-device synchronization
- Backend APIs or databases
- Timed exams
- Remote telemetry
- Guaranteeing that third-party video wording or answers remain unchanged after the verification date

## 11. Delivery

The finished project will include:

- Static deployable application
- Verified question-bank assets
- Source audit manifest
- `source-answer-corrections.txt`
- Usage and VPS deployment instructions
- Automated validation commands and results

