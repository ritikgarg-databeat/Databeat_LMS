import { ResourceType } from '@prisma/client';
import { body, query } from 'express-validator';

import {
  MAX_ESTIMATED_DURATION_MINUTES,
  MAX_LESSON_DESCRIPTION_LENGTH,
  MAX_LESSON_TITLE_LENGTH,
  MIN_ESTIMATED_DURATION_MINUTES,
} from '@/constants/classroom';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// Factories, not shared chain instances — express-validator's `.optional()` mutates the
// chain's underlying builder in place and returns the SAME reference, so a shared const reused
// bare in `create` and as `.optional()` in `update` would retroactively make `create`'s
// title/type optional too (verified: calling `.optional()` on one usage silently breaks the other).
const titleChain = () =>
  body('title')
    .trim()
    .isLength({ min: 1, max: MAX_LESSON_TITLE_LENGTH })
    .withMessage(VALIDATION_MESSAGES.MIN_LENGTH('title', 1));
const descriptionChain = body('description')
  .optional({ values: 'falsy' })
  .isString()
  .isLength({ max: MAX_LESSON_DESCRIPTION_LENGTH });
const estimatedDurationChain = body('estimatedDurationMinutes')
  .optional({ values: 'null' })
  .isInt({ min: MIN_ESTIMATED_DURATION_MINUTES, max: MAX_ESTIMATED_DURATION_MINUTES })
  .toInt();
const typeChain = () =>
  body('type').isIn(Object.values(ResourceType)).withMessage('type must be a valid resource type.');

export const lessonsValidation = {
  list: [query('moduleId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('moduleId'))],

  create: [
    body('moduleId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('moduleId')),
    titleChain(),
    descriptionChain,
    typeChain(),
    estimatedDurationChain,
  ],

  update: [titleChain().optional(), descriptionChain, typeChain().optional(), estimatedDurationChain],

  updateStatus: [body('isPublished').isBoolean().withMessage('isPublished must be a boolean.').toBoolean()],

  reorder: [
    body('moduleId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('moduleId')),
    body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array.'),
    body('orderedIds.*').isUUID().withMessage('Each id in orderedIds must be a valid identifier.'),
  ],
};
