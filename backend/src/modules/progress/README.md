# Progress Module

Owns the `LessonProgress` model — per-trainee, per-lesson learning progress tracking.

Layering: `progress.routes.ts` → `progress.controller.ts` → `progress.service.ts` → `progress.repository.ts`
(see ARCHITECTURE.md §3.1). `progress.dto.ts` defines request/response shapes, `progress.types.ts`
defines internal domain shapes, `progress.interfaces.ts` defines the contracts controllers/services
depend on, and `progress.validation.ts` holds the express-validator chains for this module's routes.

This module works directly against `Course` / `CourseModule` / `Lesson` / `LessonProgress` /
`GroupMember` / `CourseGroupAssignment` via Prisma — it deliberately does not import from the
courses/modules/lessons modules (feature-local duplication over premature cross-module coupling,
per this codebase's convention). It implements its own self-contained copy of the classroom
trainee-accessibility rule (Prompt 5 § SECURITY): a course is accessible to a user iff it is
PUBLISHED, not soft-deleted, and assigned to a group the user is a member of; a lesson is
additionally accessible to a Trainee only if the lesson and its module are both published.
Trainers/Super Admins always bypass this check. A Trainee is always given a 403 (never a 404) for
inaccessible or nonexistent content, so existence is never leaked.

## Two kinds of endpoints

**(a) Lesson-scoped** (`getForLesson` / `upsertForLesson` on `ProgressController`) — intended to be
mounted NESTED inside the lessons module's router at `GET`/`POST /lessons/:id/progress`, by
whichever engineer builds out that module. This module does **not** wire that route itself; it
just exports `ProgressController` and `progressValidation.upsertLessonProgress` from `index.ts`
for that purpose. Both handlers read the lessonId from `req.params.id` — i.e. assume they are
mounted with `mergeParams: true` on a parent router whose own id param is named `:id`, exactly
like `group-members.routes.ts` consumes its parent's `:groupId` (here it's the lessons module's
own `:id`, not a `:lessonId`). Whoever wires this should mount something like:

```ts
// inside lessons.routes.ts
import { ProgressController, progressValidation } from '@/modules/progress';

const progressController = new ProgressController();
router.get('/:id/progress', idParamValidator, progressController.getForLesson);
router.post('/:id/progress', idParamValidator, progressValidation.upsertLessonProgress, progressController.upsertForLesson);
```

**(b) Top-level `/progress`** (`progress.routes.ts`, exported as `progressRoutes`) — the trainee
dashboard / classroom aggregate endpoints (`continue-learning`, `summary`, `courses/:courseId`).
This module mounts these itself in its own `progress.routes.ts`, but does **not** register that
router in `src/routes/index.ts` — another engineer does that final mounting pass.

## Audit logging

The lesson-scoped upsert (`POST /lessons/:id/progress`) is intentionally NOT audit-logged — it
fires on routine trainee activity (viewing a lesson, letting time elapse), not a security-relevant
action, per `audit-log.service.ts`'s doc comment.
