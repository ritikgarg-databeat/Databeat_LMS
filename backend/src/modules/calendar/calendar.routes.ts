import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { CalendarController } from './calendar.controller';
import { calendarValidation } from './calendar.validation';

/**
 * Route definitions for the calendar module. Mounted in src/routes/index.ts at a top-level
 * `/calendar` path (mirroring `/courses`, NOT nested under anything).
 *
 * Trainer/Super-Admin manage all events — identical permissions, no per-trainer ownership silo,
 * matching every other management module in this codebase (Prompt 6 § SECURITY). Trainees have
 * read-only access, and only to events assigned to them via their department or group
 * memberships — `GET /events/:id` enforces this in the service layer (defense-in-depth) since
 * it depends on runtime assignment data, not just role; `GET /events/mine` is their primary
 * surface and is open to any authenticated role.
 *
 * `GET /events/mine` is registered *before* `GET /events/:id` so Express doesn't parse "mine"
 * as the `:id` param.
 */
const router = Router();
const controller = new CalendarController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/events', canManage, calendarValidation.list, controller.list);
router.post('/events', canManage, calendarValidation.create, controller.create);
router.get('/events/mine', calendarValidation.mine, controller.mine);
router.get('/events/:id', idParamValidator, controller.getById);
router.patch('/events/:id', canManage, idParamValidator, calendarValidation.update, controller.update);
router.delete('/events/:id', canManage, idParamValidator, controller.remove);

export default router;
