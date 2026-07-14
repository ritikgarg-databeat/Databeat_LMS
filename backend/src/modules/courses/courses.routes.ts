import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { CoursesController } from './courses.controller';
import { coursesValidation } from './courses.validation';

/**
 * Route definitions for the courses module. Mounted in src/routes/index.ts at a top-level
 * `/courses` path (mirroring `/groups`, NOT nested under anything).
 *
 * "Trainers and Super Admins manage all classroom content, identical permissions ... Trainees
 * have read-only access, and ONLY to content that is both PUBLISHED and assigned to a group
 * they belong to" (Prompt 5 § SECURITY) — `GET /:id` and `GET /mine` enforce this in the
 * service layer since it depends on runtime status/membership, not just role. Every other
 * route stays Trainer/Super-Admin only.
 *
 * `GET /stats` and `GET /mine` are registered *before* `GET /:id` so Express doesn't parse
 * "stats"/"mine" as the `:id` param.
 */
const router = Router();
const controller = new CoursesController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/', canManage, coursesValidation.list, controller.list);
router.post('/', canManage, coursesValidation.create, controller.create);
router.get('/stats', canManage, controller.stats);
router.get('/mine', controller.mine);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', canManage, idParamValidator, coursesValidation.update, controller.update);
router.patch('/:id/status', canManage, idParamValidator, coursesValidation.updateStatus, controller.updateStatus);
router.post('/:id/duplicate', canManage, idParamValidator, coursesValidation.duplicate, controller.duplicate);
router.delete('/:id', canManage, idParamValidator, controller.remove);
router.get('/:id/assignments', canManage, idParamValidator, controller.listAssignments);
router.post('/:id/assignments', canManage, idParamValidator, coursesValidation.assignGroup, controller.assignGroup);
router.delete(
  '/:id/assignments/:groupId',
  canManage,
  idParamValidator,
  coursesValidation.unassignGroup,
  controller.unassignGroup,
);

export default router;
