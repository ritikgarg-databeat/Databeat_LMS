# Assessment Attempts Module

Owns the `AssessmentAttempt` / `AssessmentAnswer` models — a trainee's attempt-taking flow
(start/resume, autosave answers, submit) and the resulting auto/manual grading pipeline.

Layering: `assessment-attempts.routes.ts` → `assessment-attempts.controller.ts` →
`assessment-attempts.service.ts` → `assessment-attempts.repository.ts` (see ARCHITECTURE.md
§3.1). `assessment-attempts.dto.ts` defines request/response shapes, `assessment-attempts.types.ts`
defines internal domain shapes (including the auto-gradable/manual-review `QuestionType`
groupings and the sanitized-vs-full question view shapes), and
`assessment-attempts.validation.ts` holds the express-validator chains for this module's routes.

This module works directly against `Assessment` / `AssessmentQuestion` /
`AssessmentGroupAssignment` / `Group` / `GroupMember` via Prisma for its own accessibility check
— it deliberately does not import from the assessments module (feature-local duplication over
premature cross-module coupling, mirroring the resources/progress modules' precedent from
Prompt 5). It owns `AssessmentAttempt`/`AssessmentAnswer` exclusively.

## RBAC: a hard split, not a per-endpoint check

Unlike resources/progress (any role may hit the same endpoint, branching internally), this module
splits its endpoints by role at the router level: "A Trainer/Super-Admin never 'takes' an
assessment" (Prompt 6). `/start`, `/mine`, `/mine/answers/...`, and `/mine/submit` are hard-gated
to `Role.TRAINEE` via `requireRole`; the grading queue (`GET /`), attempt detail (`GET
/:attemptId`), and manual grading (`PATCH /:attemptId/answers/:answerId/grade`) are hard-gated to
`Role.TRAINER`/`Role.SUPER_ADMIN`.

Every trainee-only endpoint additionally re-verifies, inside the service, that the specific
assessment is accessible to that trainee via `isAssessmentAccessibleToUser` (self-contained copy
of `CoursesRepository#isAccessibleToUser` from Prompt 5, replicated against
`Assessment`/`AssessmentGroupAssignment`/`Group`/`GroupMember`): the assessment must be
`PUBLISHED`, not soft-deleted, and assigned (via group) to that trainee. A trainee never learns
whether an inaccessible/nonexistent assessment exists — always a 403, never a 404.

`POST /start` additionally enforces a time window that visibility alone doesn't cover: a brand
new attempt cannot be started before `assessment.availableFrom` or after `assessment.dueDate` —
an existing attempt can be viewed after the boundary, but answer writes are rejected and the
worker finalizes saved answers automatically.

## Protected attempts and integrity evidence

The learner UI requires fullscreen before starting, hides normal application navigation, adds a
dynamic learner watermark, and intercepts common copy, print, and capture shortcuts on a
best-effort basis. `POST /assessments/:id/attempts/mine/integrity-events` stores fullscreen exits,
hidden tabs, window blur, screenshot-key attempts, and print attempts. Counted events are
deduplicated within two seconds: the first two produce warnings and the third finalizes the
attempt with `INTEGRITY_VIOLATION`. Browser controls cannot prevent operating-system or external
camera capture; stronger enforcement requires managed devices or a secure examination browser.

## No retakes; resume is idempotent

`AssessmentAttempt` is unique on `[assessmentId, userId]` — one attempt per trainee per
assessment, ever (see the model's own doc comment). `POST /start` is therefore also the resume
endpoint: calling it again while `IN_PROGRESS` just returns the existing attempt (with any
already-saved answers echoed back for pre-fill); calling it after `SUBMITTED`/`PENDING_REVIEW`/
`GRADED` throws a 409.

## The answer key is never leaked ahead of grading

Every response sent to a trainee before results are authorized to be revealed —
`POST /start`'s question list, and `GET /mine` while `IN_PROGRESS`/`SUBMITTED`/`PENDING_REVIEW` —
uses the **sanitized** question view: `snapshotOptions` has every `isCorrect` flag stripped, and
`snapshotCorrectAnswers`/`snapshotExplanation` are omitted from the payload entirely. Only once an
attempt is `GRADED` and either `assessment.showResultImmediately` is true or
`assessment.resultsReleasedAt` is set does `GET /mine` switch to
the full, un-sanitized view (options' `isCorrect`, `snapshotCorrectAnswers`, `snapshotExplanation`,
plus each answer's `isCorrect`/`marksAwarded` and the attempt's `totalScore`/`percentage`/
`passed`). Trainer/Super-Admin endpoints always see the full view — they're authorized to grade.

**`showResultImmediately` off:** a graded attempt remains masked (`totalScore`/`percentage`/
`passed` null and no answer key) until a trainer uses the assessment result-release action.

## Server-authoritative timer and expiry worker

`POST /start` stores immutable `expiresAt`, calculated as the earlier of the attempt duration and
assessment due date. Every answer save/upload checks this server timestamp; the browser timer uses
server-provided `remainingSeconds` and cannot extend the attempt by refreshing or changing its
clock. Submission clamps `timeSpentSeconds` to the same boundary and records `submissionReason`
(`LEARNER`, `TIME_EXPIRED`, or `DUE_DATE_REACHED`).

The separate scheduler worker scans `IN_PROGRESS` attempts whose `expiresAt` has passed every
minute and finalizes the answers already saved. It also runs once on startup to catch up after
downtime, uses a bounded batch, and prevents overlapping scheduled executions.

## Auto vs. manual grading (`POST /mine/submit`)

- **Auto-graded immediately**, inside one `$transaction` alongside the attempt's own update:
  - `SINGLE_CORRECT_MCQ` / `MULTIPLE_CORRECT` / `TRUE_FALSE` — the SET of `selectedOptionIds`
    must exactly match the SET of `snapshotOptions` ids where `isCorrect === true`.
  - `FILL_IN_THE_BLANK` / `SQL_QUERY` — the submitted `textAnswer`, normalized (trim + lowercase +
    collapse whitespace), must match ANY normalized entry in `snapshotCorrectAnswers`.
  - Each such `AssessmentAnswer` gets `marksAwarded` = full marks (correct) or `0` (incorrect/
    unanswered) — negative marking is applied only once, at the aggregate level (see below), not
    baked into the per-answer value.
- **Always left for manual trainer review** (`isCorrect`/`marksAwarded` stay `null`):
  `SHORT_ANSWER`, `LONG_ANSWER`, `CODE_SNIPPET`, `FILE_UPLOAD` — regardless of whether an answer
  was actually submitted. If the trainee left one of these blank, a placeholder `AssessmentAnswer`
  row is still created (blank content, ungraded) so a trainer always has an `:answerId` to grade —
  without it, that question could never be graded and the attempt would be stuck in
  `PENDING_REVIEW` forever.
- **Aggregate `autoScore`** = sum of auto-graded `marksAwarded`, minus (if
  `assessment.negativeMarkingEnabled`) `negativeMarksPerWrongAnswer` × the count of auto-gradable
  questions that were _attempted_ (an answer row exists) but wrong — skipped questions never incur
  the penalty. Floored at `0`.
- **Attempt status after submit**: if the assessment has any manual-review question at all, status
  becomes `PENDING_REVIEW` and `manualScore`/`totalScore`/`percentage`/`passed` stay `null` until a
  trainer finishes grading every one of them. If every question was auto-gradable, status becomes
  `GRADED` immediately with `manualScore = 0`, `totalScore = autoScore`, `percentage =
round(totalScore / maxMarks * 100)` (`maxMarks` = sum of this assessment's `AssessmentQuestion
.marks`; `0` if `maxMarks` is `0`), and `passed = percentage >= assessment.passingPercentage`.

## Manual grading (`PATCH /:attemptId/answers/:answerId/grade`)

Only valid for an answer whose question is one of the manual-review types. Updates that one
answer's `marksAwarded`/`isCorrect`/`gradedById`/`gradedAt`, then recomputes `manualScore` (sum of
`marksAwarded` across every manual-review-type answer for the attempt) and — **only once every
manual-review question has a non-null `marksAwarded`** — finalizes `totalScore = autoScore +
manualScore`, `percentage`, `passed`, `gradedAt`, and flips status to `GRADED`. If any manual
question is still ungraded, the attempt stays `PENDING_REVIEW` with `totalScore`/`percentage`/
`passed` left `null` (the score isn't final yet). Both the answer update and the attempt aggregate
update happen inside one `$transaction`.

## File uploads

`FILE_UPLOAD` questions are answered via the dedicated `POST
/mine/answers/:assessmentQuestionId/upload` endpoint (multipart, field name `file`), never the
JSON `PUT /mine/answers/:assessmentQuestionId` endpoint (which explicitly rejects that type,
pointing the caller at the upload endpoint instead). Reuses the shared disk-temporary `upload` multer instance
and `ACCEPTED_LESSON_MIME_TYPES`/`MAX_LESSON_FILE_SIZE_BYTES` — no separate constant set for
assessment submissions, per Prompt 6's instructions. Declared MIME types are verified against
file signatures before saving via the shared `storageProvider`
singleton with `entityType: "assessment-submissions"`. Re-uploading (replacing an answer already
submitted for that question) best-effort deletes the previous file from disk after the new one is
saved, mirroring `resources.service.ts`'s deletion precedent.

## Mounting

This module is mounted **nested** inside the assessments module's router, exactly
like `resources.routes.ts` is mounted inside `lessons.routes.ts` (`Router({ mergeParams: true
})`):

```ts
// inside assessments.routes.ts
import { assessmentAttemptsRoutes } from '@/modules/assessment-attempts';

router.use('/:id/attempts', assessmentAttemptsRoutes);
```

Resulting routes:

| Method | Path                                                                  | Access                   |
| ------ | --------------------------------------------------------------------- | ------------------------ |
| POST   | `/assessments/:id/attempts/start`                                     | Trainee only             |
| GET    | `/assessments/:id/attempts/mine`                                      | Trainee only             |
| PUT    | `/assessments/:id/attempts/mine/answers/:assessmentQuestionId`        | Trainee only             |
| POST   | `/assessments/:id/attempts/mine/answers/:assessmentQuestionId/upload` | Trainee only             |
| POST   | `/assessments/:id/attempts/mine/submit`                               | Trainee only             |
| GET    | `/assessments/:id/attempts`                                           | Trainer/Super-Admin only |
| GET    | `/assessments/:id/attempts/:attemptId`                                | Trainer/Super-Admin only |
| PATCH  | `/assessments/:id/attempts/:attemptId/answers/:answerId/grade`        | Trainer/Super-Admin only |

## Audit logging

`POST /mine/submit` records `ASSESSMENT_ATTEMPT_SUBMITTED` (`{ assessmentId, attemptId, userId,
status }`). `PATCH /:attemptId/answers/:answerId/grade` records `ASSESSMENT_ANSWER_GRADED`
(`{ attemptId, answerId, marksAwarded }`). Autosaving an answer (`PUT`/upload) is intentionally
NOT audit-logged, for the same reason the progress module's lesson-progress upsert isn't: routine
trainee activity, not a security-relevant action.
