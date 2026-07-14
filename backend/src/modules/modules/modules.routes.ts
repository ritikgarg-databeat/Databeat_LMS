import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { ModulesController } from './modules.controller';
import { modulesValidation } from './modules.validation';

/**
 * Route definitions for the modules module. Mounted in src/routes/index.ts at a top-level
 * `/modules` path, filtered by a `courseId` query/body param — mirrors how `/groups` is
 * filtered by `departmentId` rather than nesting under `/courses/:id/modules` (Prompt 5).
 *
 * This is a management/editor surface only — Trainees consume published modules through the
 * courses module's nested `GET /courses/:id` response instead, so every route here stays
 * Trainer/Super-Admin only (Prompt 5 § SECURITY — identical permissions, no per-role scoping
 * between them, same pattern as the groups module).
 */
const router = Router();
const controller = new ModulesController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate, canManage);

router.get('/', modulesValidation.list, controller.list);
router.post('/', modulesValidation.create, controller.create);
// Registered before `/:id` — otherwise Express would match "reorder" as the :id param.
router.patch('/reorder', modulesValidation.reorder, controller.reorder);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', idParamValidator, modulesValidation.update, controller.update);
router.patch('/:id/status', idParamValidator, modulesValidation.updateStatus, controller.updateStatus);
router.delete('/:id', idParamValidator, controller.remove);

export default router;
