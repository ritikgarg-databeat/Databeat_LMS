# Departments Module

Department creation and organizational structure.

Layering: `departments.routes.ts` → `departments.controller.ts` → `departments.service.ts` → `departments.repository.ts`
(see ARCHITECTURE.md §3.1). `departments.dto.ts` defines request/response shapes,
`departments.types.ts` defines internal domain shapes, and `departments.validation.ts` holds the
express-validator chains for this module's routes.

Implemented CRUD, pagination/search, stats, and safe deletion checks. Trainer reads are limited to
departments represented by their assigned active groups; Super Admins retain organization-wide
management. Department deletion is blocked while dependent users/groups still exist.
