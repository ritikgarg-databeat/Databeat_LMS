# Settings Module

User-level preferences (theme, avatar, notification mutes) plus admin-only platform
configuration.

Layering: `settings.routes.ts` → `settings.controller.ts` → `settings.service.ts` →
`settings.repository.ts` (see ARCHITECTURE.md §3.1). `settings.dto.ts` defines request-body
shapes, `settings.types.ts` defines the response shapes the service layer returns, and
`settings.validation.ts` holds the express-validator chains for this module's routes.

## Why this module, and not users/auth

`themePreference` and `avatar` are columns on `User`, and `NotificationPreference` has its own
model — but the endpoints that read/write them live here, not in the users or notifications
modules:

- **Theme and avatar** are user _preferences_, conceptually distinct from the users module's
  identity/profile-admin surface (name, email, department, role, active/inactive) and from the
  auth module's credentials surface (password, tokens). A trainee changing their own theme or
  avatar is a "settings" action, not a "manage my profile" or "manage my account security" one —
  this mirrors most consumer apps' own Settings/Preferences vs. Profile split. Splitting it out
  also means the users module's controller/service — already the largest in the codebase — never
  needs to grow multipart file-upload handling for something as small as an avatar.
- **Notification mute preferences** live on their own `NotificationPreference` model, separate
  from the `Notification` model the notifications module owns. This module queries that model
  directly via its own repository — Prisma directly, not an import from `@/modules/notifications`
  — the same feature-local-duplication convention the resources module uses for `Lesson`
  (`resources.repository.ts`) and the qna module uses in several places: cheaper than a
  cross-module dependency, and the query is a two-line `findUnique`/`upsert` either way.
- **Platform settings** are a genuinely new, admin-only concern with no existing home.

`User.themePreference` remains the cross-device source of truth (pulled on login, pushed on
change); the frontend's own `ThemeProvider` additionally keeps a localStorage copy for
pre-auth/offline-first paint (see schema.prisma's doc comment on the field) — this module's `GET
/settings` and `PATCH /settings/theme` are how those two copies stay in sync.

## Avatar upload: its own Multer instance

`POST /settings/avatar` uses `avatarUpload`, a Multer instance built locally in
`settings.routes.ts` — deliberately **not** the shared `upload` middleware
(`@/middleware/upload.middleware.ts`, sized to `MAX_LESSON_FILE_SIZE_BYTES` = 200 MB, wrong by
two orders of magnitude for a profile picture) and not a parameterized version of it. This
mirrors the qna module's own `qnaUpload` instance in `qna.routes.ts`: `memoryStorage` (so the
buffer can be handed to `storageProvider.save()`), `limits.fileSize: MAX_AVATAR_SIZE_BYTES` (2
MB), and a `fileFilter` that only accepts `image/png` / `image/jpeg` / `image/webp` /
`image/gif`, rejecting anything else by calling back with a thrown `BadRequestError` — caught by
`error.middleware.ts` and turned into a 400 before the request body is ever fully buffered for an
oversized/wrong-type file past the point Multer's own limits already reject it. Both constants
live in `@/constants/settings.ts`, following this codebase's convention of module-specific
upload limits living in top-level `constants/`, not inside the module folder.

On a successful upload, the service (`settings.service.ts#uploadAvatar`) deletes the previous
avatar file from storage _before_ saving the new one, best-effort (`.catch()` + `logger.error`,
mirroring `resources.service.ts#remove`'s identical pattern for lesson resource files) — a file
already missing on disk must never block the avatar change. That delete only fires if the old
`User.avatar` value looks like something this module actually stored (its relative path starts
with `avatars/`, the `AVATAR_ENTITY_TYPE` namespace) — `User.avatar` is a plain nullable string
with no other shape constraint, so any other value (legacy/seed data, a future
externally-hosted URL) is left untouched rather than being blindly passed to
`storageProvider.delete()`. `DELETE /settings/avatar` runs the same best-effort delete and then
sets `User.avatar` to `null`.

## The `PlatformSettings` singleton

`PlatformSettings` has no natural key to look up by — it's a single row of platform-wide config
(name, support email, maintenance mode). Rather than a DB constraint, the model uses a fixed,
known primary key (`PLATFORM_SETTINGS_SINGLETON_ID`, `constants/settings.ts`), and every
repository method that touches the table reads/creates/updates _that exact row_ — see
schema.prisma's doc comment on the model for why a DB-level "at most one row" constraint would be
overkill here. `GET /settings/platform` lazily creates the row (with schema column defaults) on
first access if it doesn't exist yet, so there's no separate seed/migration step required before
the admin settings screen works. `PATCH /settings/platform` accepts any subset of
`{platformName, supportEmail, maintenanceMode}` and always stamps `updatedById` with the acting
admin's id via the same `upsert`. Both endpoints are gated by `requireRole(SUPER_ADMIN)`, applied
per-route in `settings.routes.ts` rather than on the whole router, since every other route in this
module operates on the caller's own settings and only needs `authenticate`.

### Maintenance-mode read performance

Maintenance mode is checked for effectively every authenticated request, so it cannot be a remote
database round trip for every dashboard widget. API startup preloads the singleton setting. The
service then keeps a 30-second in-process value: fresh reads return it directly, stale reads return
the last known value immediately and launch one deduplicated background refresh. A Super Admin
update publishes its authoritative new value to the current process immediately. This keeps the
cross-cutting security gate fast without weakening server-side enforcement.

## Routes

| Method | Path                                 | Access                 | Body / Notes                                                            |
| ------ | ------------------------------------ | ---------------------- | ----------------------------------------------------------------------- |
| GET    | `/settings`                          | Any authenticated user | —                                                                       |
| PATCH  | `/settings/theme`                    | Any authenticated user | `{ theme: 'LIGHT' \| 'DARK' \| 'SYSTEM' }`                              |
| GET    | `/settings/notification-preferences` | Any authenticated user | —                                                                       |
| PATCH  | `/settings/notification-preferences` | Any authenticated user | `{ mutedTypes?: NotificationType[] }` — full replace, `[]` = unmute all |
| POST   | `/settings/avatar`                   | Any authenticated user | multipart/form-data, field `file` (image, ≤ 2 MB)                       |
| DELETE | `/settings/avatar`                   | Any authenticated user | —                                                                       |
| GET    | `/settings/platform`                 | SUPER_ADMIN only       | —                                                                       |
| PATCH  | `/settings/platform`                 | SUPER_ADMIN only       | `{ platformName?, supportEmail?, maintenanceMode? }` — partial update   |
