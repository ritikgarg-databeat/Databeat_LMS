# Modules Module

Module entity — groups lessons within a course.

Layering: `modules.routes.ts` → `modules.controller.ts` → `modules.service.ts` → `modules.repository.ts`
(see ARCHITECTURE.md §3.1). `modules.dto.ts` defines request/response shapes, `modules.types.ts`
defines internal domain shapes, `modules.interfaces.ts` defines the contracts controllers/services
depend on, and `modules.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
