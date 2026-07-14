import { Role } from '@prisma/client';
import { body, query } from 'express-validator';

import { PASSWORD_POLICY_DESCRIPTION, PASSWORD_POLICY_REGEX } from '@/constants/auth.constants';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

const nameValidator = (field: string) =>
  body(field)
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage(VALIDATION_MESSAGES.MIN_LENGTH(field, 1));

export const usersValidation = {
  create: [
    nameValidator('firstName'),
    nameValidator('lastName'),
    body('email').trim().isEmail().withMessage(VALIDATION_MESSAGES.INVALID_EMAIL).normalizeEmail(),
    body('password').matches(PASSWORD_POLICY_REGEX).withMessage(PASSWORD_POLICY_DESCRIPTION),
    body('role').isIn(Object.values(Role)).withMessage('role must be a valid role.'),
    // `{ values: 'falsy' }` treats '' the same as null/undefined — a client-side <select>'s
    // "None" option naturally submits an empty string, which is never a valid UUID/enum
    // value anyway, so treating it as "not provided" is correct, not just lenient.
    body('departmentId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage(VALIDATION_MESSAGES.INVALID_ID('departmentId')),
    body('experienceLevelId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage(VALIDATION_MESSAGES.INVALID_ID('experienceLevelId')),
  ],

  update: [
    nameValidator('firstName').optional(),
    nameValidator('lastName').optional(),
    body('departmentId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage(VALIDATION_MESSAGES.INVALID_ID('departmentId')),
    body('experienceLevelId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage(VALIDATION_MESSAGES.INVALID_ID('experienceLevelId')),
  ],

  updateOwnProfile: [
    nameValidator('firstName').optional(),
    nameValidator('lastName').optional(),
    body('avatar').optional({ values: 'null' }).isString(),
  ],

  resetPassword: [
    body('newPassword')
      .optional()
      .matches(PASSWORD_POLICY_REGEX)
      .withMessage(PASSWORD_POLICY_DESCRIPTION),
  ],

  changeRole: [
    body('role')
      .isIn([Role.TRAINER, Role.TRAINEE])
      .withMessage('role must be TRAINER or TRAINEE.'),
  ],

  list: [
    ...paginationQueryValidators,
    query('role').optional({ values: 'falsy' }).isIn(Object.values(Role)),
    query('departmentId').optional({ values: 'falsy' }).isUUID(),
    query('experienceLevelId').optional({ values: 'falsy' }).isUUID(),
    query('isActive').optional({ values: 'falsy' }).isBoolean(),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt', 'firstName', 'lastLogin']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
