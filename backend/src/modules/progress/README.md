# Progress Module

Owns the `LessonProgress` model — per-trainee, per-lesson learning progress tracking.

Layering: `progress.routes.ts` → `progress.controller.ts` → `progress.service.ts` → `progress.repository.ts`
(see ARCHITECTURE.md §3.1). `progress.dto.ts` defines request/response shapes, `progress.types.ts`
defines internal domain shapes, and `progress.validation.ts` holds the express-validator chains
for this module's routes.

This module works directly against `Course` / `CourseModule` / `Lesson` / `LessonProgress` /
`GroupMember` / `CourseGroupAssignment` via Prisma — it deliberately does not import from the
courses/modules/lessons modules (feature-local duplication over premature cross-module coupling,
per this codebase's convention). It implements its own self-contained copy of the classroom
trainee-accessibility rule (Prompt 5 § SECURITY): a course is accessible to a user iff it is
PUBLISHED, not soft-deleted, and assigned to a group the user is a member of; a lesson is
additionally accessible to a Trainee only if the lesson and its module are both published.
Trainers may read the shared published catalogue and Super Admins may read all content. A Trainee
is always given a 403 (never a 404) for
inaccessible or nonexistent content, so existence is never leaked.

When a trainer changes lesson content or adds/deletes a resource, `Lesson.contentVersion`
increments and completed progress is reopened to `IN_PROGRESS`. Historical quiz attempts remain
attached to their old version and cannot satisfy the new completion contract. Progress responses include
`hasNewContent`, derived from the newest resource creation time and the learner's last view. This
drives the trainee-facing new-content dot without adding a second notification table or state that
could drift from the lesson resources.

Mandatory course assignments flatten all published modules and lessons into one ordered sequence.
The effective value is derived from the trainee's active group assignments; mandatory wins when
the same course is assigned through multiple groups. The first
lesson without current-version completion is available; later lessons return 403 from lesson,
resource, progress, and quiz access paths until it is completed. `LessonResourceProgress` tracks
current resource versions, bounded active time, acknowledgement, viewport exposure, and merged
video coverage. Lesson completion is refused until every current resource is complete.

## Two kinds of endpoints

**(a) Lesson-scoped** (`getForLesson` / `upsertForLesson` on `ProgressController`) — mounted
inside the lessons router at `GET`/`POST /lessons/:id/progress`. Both handlers read the lessonId
from `req.params.id` — i.e. they are
mounted with `mergeParams: true` on a parent router whose own id param is named `:id`, exactly
like `group-members.routes.ts` consumes its parent's `:groupId` (here it's the lessons module's
own `:id`, not a `:lessonId`). Whoever wires this should mount something like:

```ts
// inside lessons.routes.ts
import { ProgressController, progressValidation } from '@/modules/progress';

const progressController = new ProgressController();
router.get('/:id/progress', idParamValidator, progressController.getForLesson);
router.post(
  '/:id/progress',
  idParamValidator,
  progressValidation.upsertLessonProgress,
  progressController.upsertForLesson,
);
```

**(b) Top-level `/progress`** (`progress.routes.ts`, exported as `progressRoutes`) — the trainee
dashboard / classroom aggregate endpoints (`continue-learning`, `summary`, `courses/:courseId`).
This router is registered in `src/routes/index.ts`.

The lesson viewer sends time only while visible and recently active; it flushes on visibility/
unmount boundaries. Both validation and service logic cap any single delta at 60 seconds, so a
background tab or forged oversized heartbeat cannot inflate learning time arbitrarily.

## Audit logging

The lesson-scoped upsert (`POST /lessons/:id/progress`) is intentionally NOT audit-logged — it
fires on routine trainee activity (viewing a lesson, letting time elapse), not a security-relevant
action, per `audit-log.service.ts`'s doc comment.
