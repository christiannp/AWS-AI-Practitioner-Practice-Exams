# ExamTopics and Full-Course Source Audit — Design Addendum

Date: 2026-07-29

## 1. Goal

Extend the AWS Certified AI Practitioner study app with a complete,
item-by-item audit of the 452 questions currently listed by ExamTopics and a
chapter-level coverage review of the supplied freeCodeCamp/ExamPro course.

The new material is evidence for coverage, not an authority. Every accepted
answer remains independently verified against current official AWS material.
The practice bank continues to use original wording and must not reproduce
ExamTopics questions verbatim.

Added sources:

- https://www.examtopics.com/exams/amazon/aws-certified-ai-practitioner-aif-c01/view/
- https://www.youtube.com/watch?v=WZeZZ8_W-M4

## 2. Source Roles

### 2.1 ExamTopics

ExamTopics is a practice-question source. All 452 numbered items receive an
explicit audit record, whether or not they create a new bank question.
ExamTopics answer labels, explanations, and community votes are treated as
unverified claims.

The public project stores only an original prompt summary, a non-reconstructive
hash of the normalized source prompt, source location metadata, and the audit
result. Raw recovered wording may be held in the ignored source cache while the
audit is in progress, but it is not committed or shipped with the app.

### 2.2 freeCodeCamp/ExamPro course

The nearly 15-hour course is an informational syllabus rather than a
practice-question source. Its chapters are mapped to current AIF-C01 domains,
tasks, services, and existing bank coverage. A chapter can identify a gap that
leads to an original question or cheat-sheet improvement, but it does not
contribute question-level source records.

Course statements about exam mechanics or service behavior are not accepted
without current AWS verification. In particular, beta-era claims about a
120-minute exam and case-study questions must not replace the current official
90-minute format or the four currently documented interaction types.

## 3. Complete ExamTopics Audit

### 3.1 Recovery

The recovery step creates exactly 452 ExamTopics records, numbered 1 through
452 and linked to their visible page and question location. Recovery is
resumable so a temporary page failure cannot silently remove records.

Each record contains:

- `sourceKey`, using `examtopics:aif-c01:<question-number>`
- `sourceType`, set to `examtopics`
- Source URL
- Page number and question number
- Original, non-verbatim prompt summary
- Hash of the normalized source prompt
- Source-stated answer label or labels
- Community-vote metadata when available
- Detailed disposition and reason
- Mapped bank question ID when represented
- Verification URLs and verification date when evaluated
- Correction-report reference when a source answer is confirmed wrong

The source cache may retain raw extraction data for reproducibility during
development. It remains ignored because the deployable app does not need it.

### 3.2 Dispositions

Every recovered item receives exactly one final disposition:

- `represented`: the existing bank already covers the scenario.
- `new-rewrite`: the item revealed a valid gap and produced a newly written
  bank question.
- `semantic-duplicate`: its wording differs, but its tested decision and
  conditions are equivalent to another mapped question.
- `outdated`: the source depends on superseded exam mechanics, product names,
  availability, or behavior.
- `ambiguous`: current authoritative material does not establish one
  defensible answer under the stated conditions.
- `out-of-scope`: the item does not test current AIF-C01 knowledge.
- `incorrect-source-answer`: the item is useful, but the source-stated answer
  is contradicted by current authoritative evidence.

`represented`, `new-rewrite`, `semantic-duplicate`, and
`incorrect-source-answer` records must map to a bank question. The other
dispositions must not map to one. Every disposition requires a concise,
reader-facing reason.

### 3.3 Deduplication

Deduplication occurs in three stages:

1. Reject exact normalized matches among final practice prompts.
2. Compare concept fingerprints that include the decision being tested,
   relevant AWS service, domain task, and important scenario conditions.
3. Manually review close semantic matches before creating a new question.

When several source items test the same decision, one original bank question
keeps every applicable provenance reference. The audit remains complete because
each source item still has its own record and mapped question ID.

No target bank size is imposed. The bank grows only when a verified item tests
a materially different, in-scope decision.

## 4. Answer Verification

Verification follows this order:

1. Current AWS Certification exam guide, domain pages, revisions, and in-scope
   service list
2. Current official AWS product documentation, service guides, FAQs, and
   whitepapers
3. Primary authoritative documentation for general AI or ML concepts not
   specifically defined by AWS

ExamTopics answers, community votes, video statements, blogs, and other
practice-exam sites cannot be the sole verification source.

Every accepted bank question must have:

- At least one current HTTPS verification URL
- A verification date
- An explanation supported by the cited material
- Distractor reasoning for choice-based questions
- Conditions precise enough to make the answer unambiguous

If authoritative sources conflict, the newest directly applicable AWS source
wins. The question is rewritten to remove ambiguity; if that is not possible,
the item receives the `ambiguous` disposition and is excluded from practice.

## 5. Correction Report

Every confirmed ExamTopics answer error is appended to
`source-answer-corrections.txt`. Each entry includes:

- Source name, page, question number, and URL
- Brief original question description
- Source-stated answer
- Verified answer
- Concise explanation of the discrepancy
- Official verification URL
- Verification date
- Mapped bank question ID

Community disagreement without authoritative evidence is not logged as a
confirmed error. Outdated or ambiguous questions are recorded in the audit but
are not mislabeled as incorrect-answer cases.

## 6. Data Model Changes

Question provenance becomes a discriminated union:

- YouTube provenance keeps playlist, video, question number, and timestamp.
- ExamTopics provenance keeps source key, page number, question number, and
  source URL.
- Official additions continue to require verification but need no third-party
  provenance.

The existing `source-audit.json` becomes a mixed-source manifest. It retains
all 680 existing YouTube records and adds exactly 452 ExamTopics records, for
1,132 question-source records before any future sources are added.

A new `source-materials.json` catalogs informational sources such as the full
course. Its course record contains chapter timestamps, domain/task mappings,
coverage status, identified gaps, and notes about rejected outdated claims.

The Library source filter adds an ExamTopics option. Informational course
chapters do not appear as practice groups because they are not question sets.

## 7. Course Coverage Review

The course chapter review compares its major sections with:

- Current AIF-C01 domains and tasks
- The current official in-scope service list
- Existing question concepts and services
- Existing cheat-sheet facts

Each chapter receives one of:

- `covered`: the current bank and memory sheet already teach the material.
- `gap`: a current, in-scope distinction needs an original question or memory
  note.
- `out-of-scope`: useful AWS knowledge that is not needed for this exam.
- `outdated`: the course statement conflicts with current official material.

Initial topics requiring explicit review include AWS Lake Formation, AWS Glue,
Amazon OpenSearch Service, current SageMaker AI distinctions, current Bedrock
features, evaluation, security, and the latest services added through the
official exam-guide revisions.

## 8. Validation and Tests

Content validation must fail unless:

- ExamTopics audit keys cover every integer from 1 through 452 exactly once.
- The mixed audit has 1,132 records after this source addition.
- Every record has a recognized source type, disposition, and reason.
- Every included disposition points to an existing bank question.
- Every excluded disposition has no bank question ID.
- Every `incorrect-source-answer` record has a matching correction-report
  entry.
- Every ExamTopics-derived question carries ExamTopics provenance and current
  verification.
- No final prompt has an exact normalized duplicate.
- No final prompt hash equals its source-prompt hash.
- No concept fingerprint is duplicated.
- Every course chapter has a coverage disposition.
- The app still supports only the four current official question formats and
  displays the current 90-minute exam duration where exam logistics appear.

Tests cover parsing fixtures, page/question numbering, resumption after a
failed page, mixed provenance validation, disposition contracts, correction
report linkage, deduplication, source filtering, and the full production build.

## 9. Success Criteria

The update is complete when:

1. All 452 ExamTopics items have a documented final disposition.
2. Every accepted answer has current authoritative verification.
3. Every confirmed source-answer error is logged with complete details.
4. Only verified, materially distinct gaps add questions to the bank.
5. The complete 680-record YouTube audit remains intact.
6. The course chapter review is complete and any useful verified gaps are
   reflected in original questions or the cheat sheet.
7. No exact source wording or exact practice-prompt duplicate ships.
8. Content validation, unit tests, type checking, and the production build all
   pass.
9. The verified update is committed and published to the public GitHub
   repository under `christiannp`.

## 10. Non-Goals

- Reproducing or mirroring ExamTopics content
- Treating community votes as proof
- Adding a backend, account, timer, or network-dependent app feature
- Turning the informational course into a video player or lesson platform
- Expanding into hands-on AWS labs that are outside the learner's requested
  practice-exam workflow
