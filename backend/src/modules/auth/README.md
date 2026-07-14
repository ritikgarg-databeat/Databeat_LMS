# Auth Module

Login, logout, token refresh, and password reset flows.

Layering: `auth.routes.ts` → `auth.controller.ts` → `auth.service.ts` → `auth.repository.ts`
(see ARCHITECTURE.md §3.1). `auth.dto.ts` defines request/response shapes, `auth.types.ts`
defines internal domain shapes, `auth.interfaces.ts` defines the contracts controllers/services
depend on, and `auth.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
