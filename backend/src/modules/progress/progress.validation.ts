import { LessonProgressStatus } from '@prisma/client';
import { body, param, query } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// `MAX_CONTINUE_LEARNING_LIMIT` mirrors the cap enforced defensively again in
// progress.controller.ts when the query param is absent (default 5).
const MAX_CONTINUE_LEARNING_LIMIT = 20;

export const progressValidation = {
  // Lesson-scoped body for `POST /lessons/:id/progress` — wired up by whichever module
  // mounts progress.controller.ts's `upsertForLesson` handler (see README.md).
  upsertLessonProgress: [
    body('status').optional().isIn(Object.values(LessonProgressStatus)).withMessage('status must be valid.'),
    body('timeSpentSecondsDelta')
      .optional()
      .isInt({ min: 0 })
      .withMessage('timeSpentSecondsDelta must be a non-negative integer.')
      .toInt(),
  ],

  continueLearning: [
    query('limit').optional().isInt({ min: 1, max: MAX_CONTINUE_LEARNING_LIMIT }).toInt(),
  ],

  courseProgress: [param('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'))],
};
