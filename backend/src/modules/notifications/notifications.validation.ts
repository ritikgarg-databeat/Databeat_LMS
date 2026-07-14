import { body, query } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// `title`/`message` are each only ever used bare on this one `createAnnouncement` chain (never
// both bare and `.optional()` at different call sites within this module), so plain chain
// instances are safe here — no factory needed per the express-validator `.optional()`
// in-place-mutation note (see assessments.validation.ts / calendar.validation.ts).
const MAX_ANNOUNCEMENT_TITLE_LENGTH = 200;
const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 2000;

// express-validator chains for the notifications module's routes, keyed by handler name.
export const notificationsValidation = {
  list: [...paginationQueryValidators, query('unreadOnly').optional().isIn(['true', 'false'])],

  createAnnouncement: [
    body('groupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId')),
    body('title')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: MAX_ANNOUNCEMENT_TITLE_LENGTH })
      .withMessage(VALIDATION_MESSAGES.MAX_LENGTH('title', MAX_ANNOUNCEMENT_TITLE_LENGTH)),
    body('message')
      .trim()
      .isLength({ min: 1, max: MAX_ANNOUNCEMENT_MESSAGE_LENGTH })
      .withMessage(VALIDATION_MESSAGES.REQUIRED('message')),
  ],
};
