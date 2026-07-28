# Audit Log Module

Super Admin-only read path over the `AuditLog` model.

Layering: `audit-log.routes.ts` → `audit-log.controller.ts` → `audit-log.service.ts` → the shared
`AuditLogRepository` (`@/repositories/audit-log.repository.ts`) — the same repository the
write-only `auditLogService` singleton (`@/services/audit-log.service.ts`) already uses to record
every action. This module never writes; it only adds `findMany()` to that existing repository and
a thin service/controller/route layer on top, mirroring how `modules/notifications` and
`modules/groups` share a single repository across more than one concern.

`GET /audit-logs` — `requireRole(Role.SUPER_ADMIN)`, paginated (`page`/`pageSize` →
`PaginatedData<AuditLogEntryView>`, same offset/limit convention as every other admin list
endpoint in this codebase), filterable by `action` (exact `AuditAction` enum match), `actorId`,
`targetUserId`, a `createdAtFrom`/`createdAtTo` date range, and `search` (matches the acting or
target user's name/email). Every row includes the actor and target user's `{id, firstName,
lastName, email}` inline so the frontend never needs a second lookup per row.

There is no write endpoint here and no per-Trainer scoped view — audit logs are org-wide,
Super Admin-only, by design (Prompt/Checkpoint request: close the "no audit-log viewer" gap
called out in `frontend/src/layouts/admin-layout.tsx`'s own comment explaining why no
"Security" nav item existed before this module).
