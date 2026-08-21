import { body } from 'express-validator';

import { PASSWORD_POLICY_DESCRIPTION, PASSWORD_POLICY_REGEX } from '@/constants/auth.constants';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

const emailValidator = body('email')
  .trim()
  .isEmail()
  .withMessage(VALIDATION_MESSAGES.INVALID_EMAIL)
  .normalizeEmail();

const newPasswordValidator = (field: string) =>
  body(field).matches(PASSWORD_POLICY_REGEX).withMessage(PASSWORD_POLICY_DESCRIPTION);

export const authValidation = {
  login: [
    emailValidator,
    body('password').notEmpty().withMessage(VALIDATION_MESSAGES.REQUIRED('password')),
    body('rememberMe').optional().isBoolean().withMessage('rememberMe must be a boolean.'),
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage(VALIDATION_MESSAGES.REQUIRED('currentPassword')),
    newPasswordValidator('newPassword'),
  ],

  forgotPassword: [emailValidator],

  resetPassword: [
    body('token').isString().isLength({ min: 32, max: 256 }).withMessage('A valid reset token is required.'),
    newPasswordValidator('newPassword'),
  ],
};
