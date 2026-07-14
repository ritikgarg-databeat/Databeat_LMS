# Users Module

Super Admin / Trainer user management: create, edit, disable, reset passwords.

Layering: `users.routes.ts` → `users.controller.ts` → `users.service.ts` → `users.repository.ts`
(see ARCHITECTURE.md §3.1). `users.dto.ts` defines request/response shapes, `users.types.ts`
defines internal domain shapes, `users.interfaces.ts` defines the contracts controllers/services
depend on, and `users.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
