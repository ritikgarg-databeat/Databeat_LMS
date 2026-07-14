# Groups Module

Group creation and trainee-to-group assignment.

Layering: `groups.routes.ts` → `groups.controller.ts` → `groups.service.ts` → `groups.repository.ts`
(see ARCHITECTURE.md §3.1). `groups.dto.ts` defines request/response shapes, `groups.types.ts`
defines internal domain shapes, `groups.interfaces.ts` defines the contracts controllers/services
depend on, and `groups.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
