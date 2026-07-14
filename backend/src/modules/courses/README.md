# Courses Module

Course entity — the top of the Course to Module to Lesson hierarchy.

Layering: `courses.routes.ts` → `courses.controller.ts` → `courses.service.ts` → `courses.repository.ts`
(see ARCHITECTURE.md §3.1). `courses.dto.ts` defines request/response shapes, `courses.types.ts`
defines internal domain shapes, `courses.interfaces.ts` defines the contracts controllers/services
depend on, and `courses.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
