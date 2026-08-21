# Resources Module

Owns the `LessonResource` model — attachments (files, markdown/code text, or an external link)
belonging to a single lesson.

Layering: `resources.routes.ts` → `resources.controller.ts` → `resources.service.ts` →
`resources.repository.ts` (see ARCHITECTURE.md §3.1). `resources.dto.ts` defines request/response
shapes, `resources.types.ts` defines internal domain shapes (including the file-backed vs.
text-backed `ResourceType` subsets), `resources.interfaces.ts` defines the contracts
controllers/services depend on, and `resources.validation.ts` holds the express-validator chains
for this module's routes.

This module works directly against `Lesson` / `CourseModule` / `Course` / `GroupMember` /
`CourseGroupAssignment` via Prisma for its accessibility check — it deliberately does not import
from the lessons module (feature-local duplication over premature cross-module coupling, matching
the progress module's precedent; see `progress/README.md`). It implements its own self-contained
copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY): a lesson is accessible to
a user iff its course is `PUBLISHED`, not soft-deleted, and assigned to a group the user is a
member of, AND the lesson's own module and the lesson itself are both published. Trainers/Super
Admins always bypass this check. A non-staff caller is always given a 403 (never a 404) for
inaccessible or nonexistent content, so existence is never leaked.

## Two resource shapes

`LessonResource.type` determines which fields are populated (see the model's doc comment in
`schema.prisma`):

- **File-backed** (`PDF`, `VIDEO`, `IMAGE`, `PRESENTATION`, `DOCUMENT`, `ZIP`) — created via
  `POST .../resources/upload` (multipart/form-data, field name `file`). Populates
  `relativePath` / `originalFilename` / `mimeType` / `fileSizeBytes`; `content` stays null.
- **Text-backed** (`MARKDOWN`, `CODE_SNIPPET`) and **`EXTERNAL_LINK`** — created via
  `POST .../resources/text` (JSON). Populates `content` (raw markdown/code, or a URL for
  `EXTERNAL_LINK`); the file fields stay null.

Two separate creation endpoints are used (rather than one endpoint branching on `type`) so
multipart parsing only ever happens on the upload route. Sending a text-backed type to `/upload`,
or a file-backed type to `/text`, is rejected with a `BadRequestError` that points the caller at
the correct endpoint.

New resources are appended: `order` is set to the current max `order` for the lesson + 1 (or 0 if
none exist yet). There is no reorder endpoint for resources.

## Learning invalidation

Adding or deleting a file/text resource changes the lesson's completion contract. The same
versioning semantics apply to meaningful lesson edits. The resource transaction therefore:

- increments `Lesson.contentVersion`;
- moves every `COMPLETED` `LessonProgress` row for that lesson back to `IN_PROGRESS` and clears
  `completedAt`;
- preserves historical quiz attempts under their old `contentVersion`; the next completion uses a
  new attempt for the current version.

The progress API compares the newest resource's `createdAt` with each learner's `lastViewedAt` and
returns `hasNewContent`. Trainee course and continue-learning views render this as a **New resource
added** dot. Opening the lesson acknowledges the notification by updating `lastViewedAt`, but the
lesson remains `IN_PROGRESS` until the learner completes the new quiz and marks it complete again.

Resource creation, progress reopening, and quiz invalidation are atomic. For file uploads, a saved
file is also removed if that database transaction fails, preventing an orphan upload.

## Mounting

This module is meant to be mounted **nested** inside the lessons module's router, exactly like
`group-members.routes.ts` is mounted inside `groups.routes.ts` (`Router({ mergeParams: true })`).
`lessons.routes.ts` uses `:id` (not `:lessonId`) as its own id param throughout, so the mount path
must reuse that same param name for `req.params.id` to resolve inside this module's router and
controller:

```ts
// inside lessons.routes.ts
import { resourcesRoutes } from '@/modules/resources';

router.use('/:id/resources', resourcesRoutes);
```

Resulting routes:

| Method | Path                                          | Access                                                            |
| ------ | --------------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/lessons/:id/resources`                      | Trainer/Super-Admin always; others via lesson-accessibility check |
| POST   | `/lessons/:id/resources/upload`               | Trainer/Super-Admin only                                          |
| POST   | `/lessons/:id/resources/text`                 | Trainer/Super-Admin only                                          |
| DELETE | `/lessons/:id/resources/:resourceId`          | Trainer/Super-Admin only                                          |
| GET    | `/lessons/:id/resources/:resourceId/download` | Trainer/Super-Admin always; others via lesson-accessibility check |

## File storage

Uploads go through the shared `storageProvider` singleton (`@/storage`, `entityType:
"lesson-resources"`), never `fs` directly — see `storage-provider.interface.ts`. The shared
`upload` multer instance (`@/middleware/upload.middleware.ts`) writes to an OS temporary
directory, avoiding full in-process buffering. This module validates size, declared MIME type,
and file signature before handing the temporary file to the storage provider; temporary files are
removed on success and failure. Deleting a resource deletes the on-disk file _before_ the
database row, best-effort — a file that's already missing on disk is logged and the row deletion
proceeds anyway, rather than blocking on a storage error.

Deleting a parent lesson or course collects descendant file pointers before the database
delete/soft-delete and removes those physical files afterward. Cleanup failures are logged for
manual retry. `LocalStorageProvider` rejects resolved pointers outside `UPLOAD_PATH` and exposes
`checkHealth()` to the readiness endpoint.

Downloading streams the file back with `storageProvider.getReadStream(...)`, piped straight to the
response with `Content-Disposition: attachment; filename="<originalFilename>"` and
`Content-Type: <mimeType>`. A text/link/code resource (no `relativePath`) returns 400 on download.

## Audit logging

Both creation endpoints (`/upload`, `/text`) record `RESOURCE_UPLOADED`; deletion records
`RESOURCE_DELETED` (see `audit-log.service.ts`).
