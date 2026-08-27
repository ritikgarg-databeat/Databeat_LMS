import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { upload } from '@/middleware/upload.middleware';

import { AssessmentAttemptsController } from './assessment-attempts.controller';
import { assessmentAttemptsValidation } from './assessment-attempts.validation';

/**
 * Route definitions for the assessment-attempts module. Meant to be mounted *inside*
 * assessments.routes.ts at `/:id/attempts` with `mergeParams: true` — mirrors exactly how
 * resources.routes.ts is mounted inside lessons.routes.ts (see resources.routes.ts's own header
 * comment). assessments.routes.ts is expected to use `:id` (not `:assessmentId`) as its own id
 * param throughout, so this router (and assessment-attempts.controller.ts) reads the assessment
 * id off `req.params.id` too — see README.md for the exact mount call.
 *
 * RBAC here is a hard split, not a per-endpoint accessibility check like resources/progress:
 * "A Trainer/Super-Admin never 'takes' an assessment" (Prompt 6 § RBAC ground rules), so the
 * trainee-only endpoints are gated to Role.TRAINEE and the grading/results endpoints are gated
 * to Role.TRAINER/Role.SUPER_ADMIN. Every trainee-only endpoint additionally re-verifies, inside
 * the service, that the specific assessment is actually accessible to that trainee (published,
 * not deleted, assigned to one of their groups) — see assessment-attempts.service.ts.
 *
 * `/mine`-prefixed routes are registered before `/:attemptId` so Express doesn't parse "mine" as
 * the `:attemptId` param (mirrors courses.routes.ts's stats/mine-before-`:id` precedent).
 */
const router = Router({ mergeParams: true });
const controller = new AssessmentAttemptsController();
const traineeOnly = requireRole(Role.TRAINEE);
const staffOnly = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.post('/start', traineeOnly, controller.start);
router.get('/mine', traineeOnly, controller.getMine);
router.put(
  '/mine/answers/:assessmentQuestionId',
  traineeOnly,
  assessmentAttemptsValidation.saveAnswer,
  controller.saveAnswer,
);
router.post(
  '/mine/answers/:assessmentQuestionId/upload',
  traineeOnly,
  upload.single('file'),
  assessmentAttemptsValidation.uploadAnswer,
  controller.uploadAnswer,
);
router.post('/mine/submit', traineeOnly, controller.submit);
router.post(
  '/mine/integrity-events',
  traineeOnly,
  assessmentAttemptsValidation.integrityEvent,
  controller.recordIntegrityEvent,
);

router.get('/', staffOnly, assessmentAttemptsValidation.listAttempts, controller.list);
router.get('/:attemptId', staffOnly, assessmentAttemptsValidation.attemptDetail, controller.getDetail);
router.patch(
  '/:attemptId/answers/:answerId/grade',
  staffOnly,
  assessmentAttemptsValidation.gradeAnswer,
  controller.gradeAnswer,
);

export default router;
