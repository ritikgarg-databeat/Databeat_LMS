import { query } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// express-validator chains for the reports module's routes, keyed by handler name.
//
// Shared consts, NOT factories: the factory-not-shared-instance rule (see
// qna-questions.validation.ts) only matters when a chain is reused bare in one place and with
// `.optional()` in another — `.optional()` mutates the shared builder in place. Every chain
// below is optional at every use-site, so sharing the instances is safe.
const groupIdQuery = query('groupId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'));
const courseIdQuery = query('courseId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'));
const assessmentIdQuery = query('assessmentId')
  .optional()
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('assessmentId'));

export const reportsValidation = {
  exportProgress: [groupIdQuery, courseIdQuery],
  exportResults: [assessmentIdQuery, groupIdQuery],
};
