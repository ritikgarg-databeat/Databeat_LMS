import { body, param, query } from 'express-validator';

import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

const userIdParamValidator = param('userId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('userId'));

export const groupMembersValidation = {
  add: [body('userId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('userId'))],

  addMany: [
    body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array.'),
    body('userIds.*').isUUID().withMessage('Each userId must be a valid id.'),
  ],

  remove: [userIdParamValidator],

  transfer: [
    userIdParamValidator,
    body('toGroupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('toGroupId')),
  ],

  list: [
    ...paginationQueryValidators,
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['joinedAt', 'name']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
