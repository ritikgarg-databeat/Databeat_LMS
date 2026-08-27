# Modules Module

Module entity — groups lessons within a course.

Layering: `modules.routes.ts` → `modules.controller.ts` → `modules.service.ts` → `modules.repository.ts`
(see ARCHITECTURE.md §3.1). `modules.dto.ts` defines request/response shapes, `modules.types.ts`
defines internal domain shapes, and `modules.validation.ts` holds the express-validator chains for
this module's routes.

Implemented nested course-module CRUD, publish state, and collision-safe reordering. Trainer
mutations inherit course ownership/active-group scope, while trainee responses expose only
published modules inside an accessible published course.
