import { body } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

const CODE_PATTERN = /^[A-Z0-9_]{2,30}$/;

export const experienceLevelsValidation = {
  create: [
    body('name').trim().isLength({ min: 1, max: 60 }).withMessage(VALIDATION_MESSAGES.MIN_LENGTH('name', 1)),
    body('code')
      .trim()
      .toUpperCase()
      .matches(CODE_PATTERN)
      .withMessage('code must be 2-30 uppercase letters, numbers, or underscores.'),
  ],

  update: [
    body('name').optional().trim().isLength({ min: 1, max: 60 }),
    body('isActive').optional().isBoolean(),
  ],
};
