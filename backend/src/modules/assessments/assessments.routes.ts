import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { assessmentAttemptsRoutes } from '@/modules/assessment-attempts';
import { idParamValidator } from '@/validators/common.validators';

import { AssessmentsController } from './assessments.controller';
import { assessmentsValidation } from './assessments.validation';

/**
 * Route definitions for the assessments module. Mounted in src/routes/index.ts at a top-level
 * `/assessments` path (mirroring `/courses`, NOT nested under anything).
 *
 * "Trainer/Super-Admin manage everything, identical permissions. Trainees get read-only access
 * to assessments assigned to their groups, but ONLY metadata" (Prompt 6 § RBAC) — `GET /:id`
 * and `GET /mine` enforce this in the service layer since it depends on runtime status/group
 * membership, not just role. Every other route stays Trainer/Super-Admin only.
 *
 * `GET /stats` and `GET /mine` are registered *before* `GET /:id`, and `/:id/questions/reorder`
 * *before* `/:id/questions/:aqId`, so Express doesn't parse the literal segment as a param.
 *
 * The assessment-attempts module (built in parallel) mounts a `Router({ mergeParams: true })`
 * nested under `/:id/attempts` here — exactly like `resourcesRoutes` is mounted inside
 * lessons.routes.ts at `/:id/resources` — as part of the separate wiring/integration pass. No
 * mount call for it lives in this file yet.
 */
const router = Router();
const controller = new AssessmentsController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/', canManage, assessmentsValidation.list, controller.list);
router.post('/', canManage, assessmentsValidation.create, controller.create);
router.get('/stats', canManage, controller.stats);
router.get('/mine', controller.mine);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', canManage, idParamValidator, assessmentsValidation.update, controller.update);
router.patch('/:id/status', canManage, idParamValidator, assessmentsValidation.updateStatus, controller.updateStatus);
router.post('/:id/results/release', canManage, idParamValidator, controller.releaseResults);
router.post('/:id/duplicate', canManage, idParamValidator, assessmentsValidation.duplicate, controller.duplicate);
router.delete('/:id', canManage, idParamValidator, controller.remove);

router.get('/:id/assignments', canManage, idParamValidator, controller.listAssignments);
router.post('/:id/assignments', canManage, idParamValidator, assessmentsValidation.assignGroup, controller.assignGroup);
router.delete(
  '/:id/assignments/:groupId',
  canManage,
  idParamValidator,
  assessmentsValidation.unassignGroup,
  controller.unassignGroup,
);

router.get('/:id/questions', canManage, idParamValidator, controller.listQuestions);
router.post('/:id/questions', canManage, idParamValidator, assessmentsValidation.addQuestion, controller.addQuestion);
// Registered before `/:id/questions/:aqId` — otherwise Express would match "reorder" as :aqId.
router.patch(
  '/:id/questions/reorder',
  canManage,
  idParamValidator,
  assessmentsValidation.reorderQuestions,
  controller.reorderQuestions,
);
router.patch(
  '/:id/questions/:aqId',
  canManage,
  idParamValidator,
  assessmentsValidation.updateQuestion,
  controller.updateQuestion,
);
router.delete(
  '/:id/questions/:aqId',
  canManage,
  idParamValidator,
  assessmentsValidation.removeQuestion,
  controller.removeQuestion,
);

router.use('/:id/attempts', idParamValidator, assessmentAttemptsRoutes);

export default router;
