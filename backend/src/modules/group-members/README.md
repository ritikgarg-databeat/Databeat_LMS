# Group Members Module

Add/remove/transfer trainees within a group's roster, plus CSV bulk import.

Layering: `group-members.routes.ts` → `group-members.controller.ts` → `group-members.service.ts` →
`group-members.repository.ts` (see ARCHITECTURE.md §3.1).

Mounted *inside* `groups.routes.ts` at `/:id/members` (`Router({ mergeParams: true })`), not as a
top-level `/api/v1` path — a member only ever exists in the context of a group. Kept as its own
module folder rather than living inside `groups/` because it has a distinct repository/service
surface (roster CRUD, capacity enforcement, CSV parsing) from group lifecycle management.
