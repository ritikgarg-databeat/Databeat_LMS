import { GroupStatus } from '@prisma/client';
import { body, query } from 'express-validator';

import {
  MAX_GROUP_CAPACITY,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MIN_GROUP_CAPACITY,
} from '@/constants/groups';
import { paginationQueryValidators } from '@/validators/common.validators';

const CODE_PATTERN = /^[A-Z0-9_-]{2,40}$/;

// Factories, not shared chain instances — express-validator's `.optional()` mutates the
// chain's underlying builder in place and returns the SAME reference, so a shared const reused
// bare in `create`/`duplicate` and as `.optional()` in `update` would retroactively make
// `create`'s name/code optional too (verified: calling `.optional()` on one usage silently
// breaks every other array holding that same chain reference).
const nameChain = () => body('name').trim().isLength({ min: 1, max: MAX_GROUP_NAME_LENGTH });
const codeChain = () => body('code').trim().toUpperCase().matches(CODE_PATTERN);
const descriptionChain = body('description')
  .optional({ values: 'falsy' })
  .isString()
  .isLength({ max: MAX_GROUP_DESCRIPTION_LENGTH });
// `values: 'null'` (not 'falsy') deliberately — 0 is a real, invalid value that must still hit
// the `min: 1` check below; treating it as "not provided" would silently accept a group that
// can never accept a member (see group-members.service.ts assertCapacityAvailable).
const capacityChain = body('capacity')
  .optional({ values: 'null' })
  .isInt({ min: MIN_GROUP_CAPACITY, max: MAX_GROUP_CAPACITY })
  .toInt();
const dateChain = (field: string) =>
  body(field).optional({ values: 'falsy' }).isISO8601().withMessage(`${field} must be a valid date.`);

export const groupsValidation = {
  create: [
    nameChain(),
    codeChain(),
    body('departmentId').isUUID().withMessage('departmentId is required.'),
    body('experienceLevelId').optional({ values: 'falsy' }).isUUID(),
    body('trainerId').optional({ values: 'falsy' }).isUUID(),
    descriptionChain,
    dateChain('startDate'),
    dateChain('endDate'),
    capacityChain,
  ],

  update: [
    nameChain().optional(),
    codeChain().optional(),
    body('departmentId').optional({ values: 'falsy' }).isUUID(),
    body('experienceLevelId').optional({ values: 'falsy' }).isUUID(),
    descriptionChain,
    dateChain('startDate'),
    dateChain('endDate'),
    capacityChain,
  ],

  updateStatus: [body('status').isIn(Object.values(GroupStatus)).withMessage('status must be valid.')],

  duplicate: [nameChain(), codeChain()],

  assignTrainer: [body('trainerId').optional({ values: 'falsy' }).isUUID()],

  list: [
    ...paginationQueryValidators,
    query('status').optional({ values: 'falsy' }).isIn(Object.values(GroupStatus)),
    query('departmentId').optional({ values: 'falsy' }).isUUID(),
    query('experienceLevelId').optional({ values: 'falsy' }).isUUID(),
    query('trainerId').optional({ values: 'falsy' }).isUUID(),
    query('search').optional().isString().trim(),
    query('startDateFrom').optional({ values: 'falsy' }).isISO8601(),
    query('startDateTo').optional({ values: 'falsy' }).isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'name', 'startDate', 'endDate']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
