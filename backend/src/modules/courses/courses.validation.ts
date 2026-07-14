import { CourseDifficulty, CourseStatus } from '@prisma/client';
import { body, param, query } from 'express-validator';

import {
  MAX_COURSE_DESCRIPTION_LENGTH,
  MAX_COURSE_TITLE_LENGTH,
  MAX_ESTIMATED_DURATION_MINUTES,
  MIN_ESTIMATED_DURATION_MINUTES,
} from '@/constants/classroom';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// A factory, not a shared chain instance — express-validator's `.optional()` mutates the
// chain's underlying builder in place and returns the SAME reference, so a shared const reused
// bare in `create` and as `.optional()` in `update` would retroactively make `create`'s title
// optional too (verified: calling `.optional()` on one usage silently breaks the other).
const titleChain = () => body('title').trim().isLength({ min: 1, max: MAX_COURSE_TITLE_LENGTH });

// `values: 'null'` (not 'falsy') deliberately — an explicit `null` must still pass through to
// clear the field on update, while a genuinely invalid falsy value (e.g. an empty-string
// departmentId, or `0` minutes) still hits its own validator instead of being silently treated
// as "not provided" — mirrors the fix already applied in groups.validation.ts's capacityChain.
const descriptionChain = body('description').optional({ values: 'null' }).isString().isLength({ max: MAX_COURSE_DESCRIPTION_LENGTH });
const thumbnailChain = body('thumbnail').optional({ values: 'null' }).isString();
const departmentIdChain = body('departmentId').optional({ values: 'null' }).isUUID();
const experienceLevelIdChain = body('experienceLevelId').optional({ values: 'null' }).isUUID();
const estimatedDurationChain = body('estimatedDurationMinutes')
  .optional({ values: 'null' })
  .isInt({ min: MIN_ESTIMATED_DURATION_MINUTES, max: MAX_ESTIMATED_DURATION_MINUTES })
  .toInt();
const difficultyChain = body('difficulty').optional().isIn(Object.values(CourseDifficulty)).withMessage('difficulty must be valid.');
const groupIdParamValidator = param('groupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'));

export const coursesValidation = {
  create: [
    titleChain(),
    descriptionChain,
    thumbnailChain,
    departmentIdChain,
    experienceLevelIdChain,
    estimatedDurationChain,
    difficultyChain,
  ],

  update: [
    titleChain().optional(),
    descriptionChain,
    thumbnailChain,
    departmentIdChain,
    experienceLevelIdChain,
    estimatedDurationChain,
    difficultyChain,
  ],

  updateStatus: [body('status').isIn(Object.values(CourseStatus)).withMessage('status must be valid.')],

  duplicate: [titleChain()],

  assignGroup: [body('groupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'))],

  unassignGroup: [groupIdParamValidator],

  list: [
    ...paginationQueryValidators,
    query('status').optional({ values: 'falsy' }).isIn(Object.values(CourseStatus)),
    query('difficulty').optional({ values: 'falsy' }).isIn(Object.values(CourseDifficulty)),
    query('departmentId').optional({ values: 'falsy' }).isUUID(),
    query('experienceLevelId').optional({ values: 'falsy' }).isUUID(),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt', 'title']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
