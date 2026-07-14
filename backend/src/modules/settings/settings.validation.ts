import { NotificationType, ThemePreference } from '@prisma/client';
import { body } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

// express-validator chains for the settings module's routes, keyed by handler name. No route
// here needs a `.optional()` vs. bare split of the same field across two handlers (this
// module's every writable field lives on exactly one endpoint), so — unlike qna-questions.
// validation.ts's `titleChain()`-style factories — plain chain literals are safe here.
export const settingsValidation = {
  updateTheme: [
    body('theme')
      .isIn(Object.values(ThemePreference))
      .withMessage(`theme must be one of ${Object.values(ThemePreference).join(', ')}.`),
  ],

  updateNotificationPreferences: [
    body('mutedTypes').optional().isArray().withMessage('mutedTypes must be an array.'),
    body('mutedTypes.*')
      .isIn(Object.values(NotificationType))
      .withMessage('Each muted type must be a valid notification type.'),
  ],

  updatePlatformSettings: [
    body('platformName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage(VALIDATION_MESSAGES.MAX_LENGTH('platformName', 100)),
    // `nullable: true` — the frontend sends `supportEmail: null` to intentionally clear a
    // previously-set address (an empty string field can't otherwise round-trip through
    // `.isEmail()`), so `null` must skip validation the same way `undefined` (field omitted,
    // "leave unchanged") does.
    body('supportEmail')
      .optional({ nullable: true })
      .trim()
      .isEmail()
      .withMessage(VALIDATION_MESSAGES.INVALID_EMAIL),
    body('maintenanceMode').optional().isBoolean().withMessage('maintenanceMode must be a boolean.'),
  ],
};
