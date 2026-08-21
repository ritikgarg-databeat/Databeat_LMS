# Calendar Module

Calendar events: meetings, live sessions, deadlines, holidays, exams.

Layering: `calendar.routes.ts` → `calendar.controller.ts` → `calendar.service.ts` → `calendar.repository.ts`
(see ARCHITECTURE.md §3.1). `calendar.dto.ts` defines request/response shapes, `calendar.types.ts`
defines internal domain shapes, `calendar.interfaces.ts` defines the contracts controllers/services
depend on, and `calendar.validation.ts` holds the express-validator chains for this module's routes.

Implemented CRUD supports department, active-group, and individual-user targeting. Read queries
resolve the current user's applicable events and synthesized assessment deadlines; trainer
mutations are restricted to their authorized scope. Create/update notifications are fanned out to
affected users, and database constraints enforce a valid target shape.
