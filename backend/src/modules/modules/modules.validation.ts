import { body, query } from 'express-validator';

import {
  MAX_ESTIMATED_DURATION_MINUTES,
  MAX_MODULE_DESCRIPTION_LENGTH,
  MAX_MODULE_TITLE_LENGTH,
  MIN_ESTIMATED_DURATION_MINUTES,
} from '@/constants/classroom';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// A factory, not a shared chain instance — express-validator's `.optional()` mutates the
// chain's underlying builder in place and returns the SAME reference, so a shared const reused
// bare in `create` and as `.optional()` in `update` would retroactively make `create`'s title
// optional too (verified: calling `.optional()` on one usage silently breaks the other).
const titleChain = () =>
  body('title')
    .trim()
    .isLength({ min: 1, max: MAX_MODULE_TITLE_LENGTH })
    .withMessage(VALIDATION_MESSAGES.MIN_LENGTH('title', 1));
const descriptionChain = body('description')
  .optional({ values: 'falsy' })
  .isString()
  .isLength({ max: MAX_MODULE_DESCRIPTION_LENGTH });
const estimatedDurationChain = body('estimatedDurationMinutes')
  .optional({ values: 'null' })
  .isInt({ min: MIN_ESTIMATED_DURATION_MINUTES, max: MAX_ESTIMATED_DURATION_MINUTES })
  .toInt();

export const modulesValidation = {
  list: [query('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'))],

  create: [
    body('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId')),
    titleChain(),
    descriptionChain,
    estimatedDurationChain,
  ],

  update: [titleChain().optional(), descriptionChain, estimatedDurationChain],

  updateStatus: [body('isPublished').isBoolean().withMessage('isPublished must be a boolean.').toBoolean()],

  reorder: [
    body('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId')),
    body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array.'),
    body('orderedIds.*').isUUID().withMessage('Each id in orderedIds must be a valid identifier.'),
  ],
};
