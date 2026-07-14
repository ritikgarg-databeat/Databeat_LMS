# Lessons Module

Lesson entity, lesson resources, and learner progress tracking.

Layering: `lessons.routes.ts` → `lessons.controller.ts` → `lessons.service.ts` → `lessons.repository.ts`
(see ARCHITECTURE.md §3.1). `lessons.dto.ts` defines request/response shapes, `lessons.types.ts`
defines internal domain shapes, `lessons.interfaces.ts` defines the contracts controllers/services
depend on, and `lessons.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
