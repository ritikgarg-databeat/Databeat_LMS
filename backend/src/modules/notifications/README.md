# Notifications Module

In-app notification delivery, preferences, announcements, and scheduled reminders. Password-reset
email/webhook delivery lives in `services/password-reset-delivery.service.ts`, not this module.

Layering: `notifications.routes.ts` → `notifications.controller.ts` → `notifications.service.ts` → `notifications.repository.ts`
(see ARCHITECTURE.md §3.1). `notifications.dto.ts` defines request/response shapes, `notifications.types.ts`
defines internal domain shapes, `notifications.interfaces.ts` defines the contracts controllers/services
depend on, and `notifications.validation.ts` holds the express-validator chains for this module's routes.

Every route is scoped to the current user's own notifications (list/unread-count/mark-read/mark-all-read) — there is no admin surface for managing another user's notifications.

The important export for OTHER modules is `notificationsService` (a singleton, exported from `index.ts` alongside the router — mirrors `auditLogService`'s role): call `notificationsService.notify({userId, type, title, message, relatedEntityType?, relatedEntityId?})` or `.notifyMany(userIds, {...})` directly from any module that needs to raise a notification (assessment assignment, calendar event create/update) rather than duplicating notification-creation logic.

`ASSESSMENT_DEADLINE_APPROACHING` reminders are generated proactively by the separate scheduler
worker. It performs a startup catch-up and a non-overlapping daily run; entity/user deduplication
prevents a second reminder for the same assessment. Notification list requests are read-only and
never run the reminder scan, keeping the portal header fast and predictable.

## Prompt 9 additions

- **`DELETE /notifications/:id`** — owner-only hard delete of one's own notification row. 404 if the row doesn't exist, 403 if it belongs to another user (mirrors `markRead`'s existing 404-then-403 shape exactly).
- **Preference-gated `notify()`/`notifyMany()`** — before writing any `Notification` row, both methods now check the target user's `NotificationPreference.mutedTypes` (see schema.prisma's doc comment on that model) and silently skip that user if the type is muted — no error, no row, no change to any caller. `notifyMany` batches this with one `findMutedTypesByUserIds` query for every target user instead of one query per user. This is the _only_ place the check lives — assessments/calendar/qna's call sites are untouched.
- **`COURSE_ASSIGNED`** — `CoursesService#assignGroup` (courses.service.ts) now fires a best-effort `notificationsService.notifyMany(...)` to every member of the newly-assigned group right after the `CourseGroupAssignment` commits, `.catch()`-logged exactly like `AssessmentsService#assignGroup`'s existing `ASSESSMENT_ASSIGNED` call.
- **`ASSESSMENT_RESULTS_RELEASED`** — a one-time result release notifies every learner with a
  submitted attempt. Preference checks and bulk creation use the same `notifyMany` path.
- **`POST /notifications/announcements`** — TRAINER/SUPER_ADMIN only (`requireRole`). A TRAINER may only target a group where `Group.trainerId` is their own id (403 otherwise, mirroring the analytics module's trainer-scoping idiom); SUPER_ADMIN may target any existing group (404 if it doesn't exist). Resolves every TRAINEE `GroupMember` of that group and calls `notifyMany(..., {type: 'TRAINER_ANNOUNCEMENT', ...})` directly (not best-effort — sending the notification IS the point of this endpoint, unlike the assignment call sites above where it's a side effect). Returns `{notifiedCount}`. Registered before `/:id`-style routes so "announcements" is never parsed as an `:id`.
