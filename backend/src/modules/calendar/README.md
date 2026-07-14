# Calendar Module

Calendar events: meetings, live sessions, deadlines, holidays, exams.

Layering: `calendar.routes.ts` → `calendar.controller.ts` → `calendar.service.ts` → `calendar.repository.ts`
(see ARCHITECTURE.md §3.1). `calendar.dto.ts` defines request/response shapes, `calendar.types.ts`
defines internal domain shapes, `calendar.interfaces.ts` defines the contracts controllers/services
depend on, and `calendar.validation.ts` holds the express-validator chains for this module's routes.

Foundation scaffolding only — no business logic or endpoints registered yet.
