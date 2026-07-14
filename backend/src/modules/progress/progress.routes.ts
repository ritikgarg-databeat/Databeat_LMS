import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';

import { ProgressController } from './progress.controller';
import { progressValidation } from './progress.validation';

/**
 * Top-level `/progress` router (trainee dashboard / classroom aggregate endpoints) — mounted in
 * src/routes/index.ts by another engineer. Any authenticated role may call these for their OWN
 * progress; a Trainer/Super-Admin simply gets an empty/zeroed-out result since they have no
 * learner progress of their own (see progress.service.ts).
 *
 * The lesson-scoped `GET`/`POST /lessons/:id/progress` endpoints are NOT registered here — see
 * README.md for how another engineer nests `ProgressController`'s `getForLesson`/`upsertForLesson`
 * handlers (and `progressValidation.upsertLessonProgress`) inside the lessons module's router instead.
 */
const router = Router();
const controller = new ProgressController();

router.use(authenticate);

router.get('/continue-learning', progressValidation.continueLearning, controller.continueLearning);
router.get('/summary', controller.summary);
router.get('/courses/:courseId', progressValidation.courseProgress, controller.courseProgress);

export default router;
