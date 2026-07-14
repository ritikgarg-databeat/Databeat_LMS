import { DepartmentStatus } from '@prisma/client';
import { body, query } from 'express-validator';

import { MAX_DEPARTMENT_NAME_LENGTH } from '@/constants/departments';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

const CODE_PATTERN = /^[A-Z0-9_-]{2,30}$/;

export const departmentsValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 1, max: MAX_DEPARTMENT_NAME_LENGTH })
      .withMessage(VALIDATION_MESSAGES.MIN_LENGTH('name', 1)),
    body('code')
      .trim()
      .toUpperCase()
      .matches(CODE_PATTERN)
      .withMessage('code must be 2-30 uppercase letters, numbers, underscores, or dashes.'),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  ],

  update: [
    body('name').optional().trim().isLength({ min: 1, max: MAX_DEPARTMENT_NAME_LENGTH }),
    body('code').optional().trim().toUpperCase().matches(CODE_PATTERN),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  ],

  updateStatus: [body('status').isIn(Object.values(DepartmentStatus)).withMessage('status must be valid.')],

  list: [
    ...paginationQueryValidators,
    query('status').optional({ values: 'falsy' }).isIn(Object.values(DepartmentStatus)),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt', 'name']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
