# Assessments Module

Trainer-authored assessment configuration: CRUD, publish lifecycle, group assignment, and the
question-bank-backed question list within an assessment. Attempt-taking/grading lives in the
separate assessment-attempts module, mounted at `/:id/attempts` by `assessments.routes.ts`.

Layering: `assessments.routes.ts` → `assessments.controller.ts` → `assessments.service.ts` → `assessments.repository.ts`
(see ARCHITECTURE.md §3.1). `assessments.dto.ts` defines request/response shapes,
`assessments.types.ts` defines internal domain shapes, and `assessments.validation.ts` holds the
express-validator chains for this module's routes.

Mounted in `src/routes/index.ts` at a top-level `/assessments` path (mirrors `/courses`, not nested).

## RBAC

Super Admin manages all assessments. Trainers manage definitions they created and may reuse an
assessment assigned to their own groups; attempt access and grading stay within those groups.
Trainees get read-only access to `GET /assessments/:id` (metadata only, gated by
`AssessmentsRepository#isAccessibleToUser`) and
`GET /assessments/mine` — never the question content/answer key, which is exclusively served
through the attempts module's start-attempt endpoint (sanitized).

## Cross-module contracts

- `AssessmentsRepository.isAccessibleToUser(assessmentId, userId): Promise<boolean>` — published,
  not soft-deleted, and assigned (via group membership) to the user. Mirrors
  `CoursesRepository.isAccessibleToUser`'s exact shape. The assessment-attempts module keeps its
  own self-contained copy of this same logic (feature-local duplication, per this codebase's
  convention) rather than importing this one.
- This module imports `QuestionsRepository` from `@/modules/questions` and calls
  `findByIdWithOptions(questionId)` to snapshot a bank question's content onto a new
  `AssessmentQuestion` row (`POST /:id/questions`).
- Calls `notificationsService.notifyMany(...)` (from `@/modules/notifications`) with
  `type: 'ASSESSMENT_ASSIGNED'` whenever a group is assigned to an assessment.

## Notable implementation choices

- `maxMarks` is never stored — always computed on demand as the sum of the assessment's
  `AssessmentQuestion.marks` (same on-demand-aggregate precedent as course/module completion %).
- `PATCH /:id/questions/:aqId` (marks re-weighting) reuses the `ASSESSMENT_UPDATED` audit action
  rather than a dedicated one, with metadata identifying the assessmentQuestionId and the
  before/after marks values.
- `PATCH /:id/questions/reorder` writes new `order` values in two passes (all rows first moved to
  distinct negative placeholders, then to their final 0..N-1 values) inside a `$transaction`,
  because `AssessmentQuestion` has a `@@unique([assessmentId, order])` constraint that a single-pass
  sequential update could trip when two rows swap positions. It also validates `orderedIds`
  contains every sibling `AssessmentQuestion` id (not a subset) before writing — the same partial-
  reorder bug found and fixed in Prompt 5's module/lesson reorder endpoints.
- `POST /:id/duplicate` deep-copies `AssessmentQuestion` snapshot fields verbatim (does not
  re-snapshot from the live bank question) and does not copy group assignments or attempts —
  mirrors `CoursesRepository#duplicate`'s precedent (Prompt 5).
- Once any attempt exists, scoring/structure fields and question mutations are locked. This
  preserves the meaning of historical and in-progress results.
- When `showResultImmediately` is off, `POST /:id/results/release` sets `resultsReleasedAt` after
  at least one submitted attempt. Learners with submitted attempts receive an
  `ASSESSMENT_RESULTS_RELEASED` notification; release is one-way and audit logged.
