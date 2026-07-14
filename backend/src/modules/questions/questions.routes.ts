import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { QuestionsController } from './questions.controller';
import { questionsValidation } from './questions.validation';

/**
 * Route definitions for the questions module (the flat, top-level question bank). Mounted in
 * src/routes/index.ts at a top-level `/questions` path (mirroring `/courses` — NOT nested under
 * `/assessments`; an assessment references a bank question via a separate AssessmentQuestion
 * snapshot owned by the assessments module).
 *
 * Trainer/Super-Admin manage everything here, identical permissions, no per-role scoping
 * between them (Prompt 6 § questions module). Trainees have NO access to this module at all —
 * they only ever see assessment content through the attempts flow — so every route requires
 * `canManage`, unlike courses/groups which carve out trainee-readable routes.
 */
const router = Router();
const controller = new QuestionsController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate, canManage);

router.get('/', questionsValidation.list, controller.list);
router.post('/', questionsValidation.create, controller.create);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', idParamValidator, questionsValidation.update, controller.update);
router.patch('/:id/status', idParamValidator, questionsValidation.updateStatus, controller.updateStatus);
router.delete('/:id', idParamValidator, controller.remove);

export default router;
