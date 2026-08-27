import { LessonProgressStatus } from '@prisma/client';
import { body, param, query } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// `MAX_CONTINUE_LEARNING_LIMIT` mirrors the cap enforced defensively again in
// progress.controller.ts when the query param is absent (default 5).
const MAX_CONTINUE_LEARNING_LIMIT = 20;
// The browser flushes every 30 seconds. A bounded allowance absorbs timer jitter while rejecting
// forged or stale-tab deltas that would otherwise inflate analytics by hours in one request.
const MAX_TIME_SPENT_DELTA_SECONDS = 60;

export const progressValidation = {
  // Lesson-scoped body for `POST /lessons/:id/progress` — wired up by whichever module
  // mounts progress.controller.ts's `upsertForLesson` handler (see README.md).
  upsertLessonProgress: [
    body('status').optional().isIn(Object.values(LessonProgressStatus)).withMessage('status must be valid.'),
    body('timeSpentSecondsDelta')
      .optional()
      .isInt({ min: 0, max: MAX_TIME_SPENT_DELTA_SECONDS })
      .withMessage(`timeSpentSecondsDelta must be between 0 and ${MAX_TIME_SPENT_DELTA_SECONDS}.`)
      .toInt(),
  ],

  continueLearning: [query('limit').optional().isInt({ min: 1, max: MAX_CONTINUE_LEARNING_LIMIT }).toInt()],

  courseProgress: [param('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'))],
};
