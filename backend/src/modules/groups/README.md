# Groups Module

Group creation and trainee-to-group assignment.

Layering: `groups.routes.ts` → `groups.controller.ts` → `groups.service.ts` → `groups.repository.ts`
(see ARCHITECTURE.md §3.1). `groups.dto.ts` defines request/response shapes, `groups.types.ts`
defines internal domain shapes, and `groups.validation.ts` holds the express-validator chains for
this module's routes.

Implemented lifecycle management includes create/edit, archive/restore, trainer assignment,
capacity, stats, and nested roster operations. `ACTIVE` plus `deletedAt: null` is the single
learning-access policy: archived/deleted groups cannot grant courses, assessments, AI context,
progress, calendar, Q&A, dashboard, or notification targeting. Trainers remain scoped to groups
they own; Super Admins can manage all groups.
