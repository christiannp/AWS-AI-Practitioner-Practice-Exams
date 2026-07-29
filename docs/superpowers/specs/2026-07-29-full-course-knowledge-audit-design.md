# Full-Course Knowledge Audit — Design Specification

Date: 2026-07-29

## 1. Goal

Use the supplied freeCodeCamp/ExamPro course as an informational syllabus for
the existing AWS Certified AI Practitioner study app:

https://www.youtube.com/watch?v=WZeZZ8_W-M4

Compare every major course chapter with the current AIF-C01 exam guide, current
in-scope service list, verified question bank, and cheat sheet. Add only
materially distinct, current, independently verified knowledge gaps.

ExamTopics is explicitly excluded. No ExamTopics page, answer, question,
community vote, parser, cache, provenance, dependency, filter, or audit record
remains in the project.

## 2. Source Role

The course is not an answer authority and is not a practice-question source.
It contributes a chapter-level coverage map only. Each useful gap becomes an
original question or memory note whose factual support comes from current
official AWS documentation.

The project does not commit the course transcript. The public manifest stores
only course metadata, chapter titles and timestamps, coverage classifications,
short original reasons, and official verification URLs.

## 3. Chapter Audit

Audit these 16 chapters:

1. Introduction — 00:00:00
2. AI and ML Fundamentals — 00:17:48
3. Data — 01:16:47
4. Gen AI Primer — 01:31:48
5. Amazon Bedrock — 02:02:22
6. Datastores for GenAI — 07:16:00
7. PartyRock — 07:52:18
8. Amazon SageMaker AI — 08:08:46
9. Evaluations — 09:41:44
10. AI Developer Tools — 10:06:38
11. AWS Managed ML — 10:30:14
12. Generative AI Security — 13:19:30
13. Amazon Athena — 13:35:18
14. AWS Glue — 13:51:15
15. Amazon OpenSearch Service — 14:33:06
16. AWS Lake Formation — 14:56:12

Each chapter receives one coverage value:

- `covered`: the existing bank and cheat sheet already teach the current,
  in-scope decisions.
- `gap`: a current in-scope distinction needs an original verified question
  or memory note.
- `out-of-scope`: the chapter can be useful AWS knowledge but is not currently
  listed for AIF-C01 and does not justify a new practice question.
- `outdated`: the course statement conflicts with the current exam guide or
  current AWS behavior.

Every chapter record includes domain/task mappings where applicable, concepts,
a concise reason, and at least one current official HTTPS verification URL.

## 4. Known Freshness Corrections

The course was recorded around the beta exam. The manifest must explicitly
reject these outdated mechanics:

- Course claim: 120-minute exam duration.
- Current rule: 90-minute exam duration.
- Course claim: case studies are an exam interaction format.
- Current rule: the exam guide currently lists multiple choice, multiple
  response, ordering, and matching only.

The current exam remains 65 questions: 50 scored and 15 unscored.

PartyRock and Amazon Athena are not in the current AIF-C01 in-scope service
list, so their chapters do not create practice questions. The current list
does include AWS Glue, AWS Lake Formation, and Amazon OpenSearch Service.

## 5. Verified Gap Treatment

The current bank already has strong coverage of Amazon Bedrock, Amazon
SageMaker AI, RAG, vector search, Amazon OpenSearch Service, AWS Glue,
evaluation, responsible AI, and security.

AWS Lake Formation is the guaranteed explicit gap. Add:

- An official-addition concept and original question teaching that Lake
  Formation centrally governs fine-grained access to data lake resources and
  builds on the AWS Glue Data Catalog.
- A memory card distinguishing AWS Glue Data Catalog, AWS Lake Formation, and
  Amazon Macie.

If the chapter audit reveals another material current gap, it follows the same
rules: original wording, one unambiguous correct answer, official verification,
dated evidence, explanation, and distractor reasoning. Do not add a question
merely because a service is mentioned in the course.

## 6. Data and Validation

Add `public/data/source-materials.json` with one informational course record.
The record contains:

- Stable ID `youtube:WZeZZ8_W-M4`
- Title, author, URL, and duration of 53,928 seconds
- The 16 chapter records
- Rejected beta-era claims with current replacements and official sources

Content validation must fail unless:

- The course exists once with exactly 16 unique, increasing timestamps.
- Every chapter has a recognized coverage value, reason, and official HTTPS
  verification.
- The 120-minute and case-study claims are explicitly rejected.
- Every `gap` concept appears in both the question bank and cheat sheet.
- The generated bank retains unique IDs, normalized prompts, and fingerprints.
- The existing 680-record YouTube practice-question audit remains unchanged.
- No ExamTopics artifacts or references remain.
- All tests, type checking, and the Vite production build pass.

## 7. Product Impact

No new screen, filter, timer, account, backend, or network dependency is
added. The learner experiences the update through stronger verified questions,
the weak-first cheat sheet, and the existing adaptive practice flow.

## 8. Success Criteria

The update is complete when:

1. All 16 course chapters have final coverage classifications.
2. Outdated beta exam mechanics are rejected in favor of the current guide.
3. Lake Formation and any other material current gap are taught with original
   verified content.
4. ExamTopics is completely absent from code, dependencies, data, and UI.
5. The 680-item playlist audit and existing learner features remain intact.
6. `npm run check` passes from the final committed state.
7. A broad code/content review approves the branch.
8. The reviewed branch is pushed to the user's public GitHub repository.
