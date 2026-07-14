import { query } from 'express-validator';

import { LEADERBOARD_MAX_LIMIT } from '@/constants/analytics';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// express-validator chains for the analytics module's routes, keyed by handler name. The `:id`
// params are validated at the routing layer via the shared `idParamValidator`
// (@/validators/common.validators), following every other module's convention.
export const analyticsValidation = {
  groups: [
    query('departmentId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('departmentId')),
  ],

  leaderboard: [
    query('groupId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId')),
    query('departmentId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('departmentId')),
    query('courseId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId')),
    query('limit').optional().isInt({ min: 1, max: LEADERBOARD_MAX_LIMIT }).toInt(),
  ],
};
