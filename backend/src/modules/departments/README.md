# Departments Module

Department creation and organizational structure.

Layering: `departments.routes.ts` → `departments.controller.ts` → `departments.service.ts` → `departments.repository.ts`
(see ARCHITECTURE.md §3.1). `departments.dto.ts` defines request/response shapes, `departments.types.ts`
defines internal domain shapes, `departments.interfaces.ts` defines the contracts controllers/services
depend on, and `departments.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
