import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { lessonQuizRoutes } from '@/modules/lesson-quiz';
import { ProgressController, progressValidation } from '@/modules/progress';
import { resourcesRoutes } from '@/modules/resources';
import { videoGenerationRoutes } from '@/modules/video-generation';
import { idParamValidator } from '@/validators/common.validators';

import { LessonsController } from './lessons.controller';
import { lessonsValidation } from './lessons.validation';

/**
 * Route definitions for the lessons module. Mounted in src/routes/index.ts at a top-level
 * `/lessons` path, filtered by a `moduleId` query/body param — mirrors how `/groups` is
 * filtered by `departmentId` rather than nesting under `/modules/:id/lessons` (Prompt 5).
 *
 * `GET /:id` is the one route a Trainee may reach — it doubles as the trainee lesson viewer,
 * gated inside the service via `LessonsRepository#isAccessibleToUser` rather than by role
 * (Prompt 5 § SECURITY). Every other route (management/editor use) stays Trainer/Super-Admin
 * only, identical permissions between the two roles per the groups-module pattern.
 */
const router = Router();
const controller = new LessonsController();
const progressController = new ProgressController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/', canManage, lessonsValidation.list, controller.list);
router.post('/', canManage, lessonsValidation.create, controller.create);
// Registered before `/:id` — otherwise Express would match "reorder" as the :id param.
router.patch('/reorder', canManage, lessonsValidation.reorder, controller.reorder);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', canManage, idParamValidator, lessonsValidation.update, controller.update);
router.patch('/:id/status', canManage, idParamValidator, lessonsValidation.updateStatus, controller.updateStatus);
router.delete('/:id', canManage, idParamValidator, controller.remove);

router.get('/:id/progress', idParamValidator, progressController.getForLesson);
router.post(
  '/:id/progress',
  idParamValidator,
  progressValidation.upsertLessonProgress,
  progressController.upsertForLesson,
);

router.use('/:id/resources', idParamValidator, resourcesRoutes);
router.use('/:id/video-generations', idParamValidator, videoGenerationRoutes);
router.use('/:id/quiz', idParamValidator, lessonQuizRoutes);

export default router;
