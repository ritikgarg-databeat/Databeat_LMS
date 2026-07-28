import { body, query } from 'express-validator';

import { MAX_TIMING_OBSERVATION_DURATION_SECONDS, MAX_TIMING_OBSERVATION_NOTES_LENGTH } from '@/constants/timing-observations';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// This module only ever has a `create` chain (no update), so there's no risk of the
// shared-chain `.optional()` mutation bug documented in qna-questions.validation.ts — but the
// filter chains below are still written as bare consts since both `list` and `stats` use them
// identically (both always-optional, never re-derived with `.optional()` added after the fact).
const lessonIdFilter = query('lessonId').optional({ values: 'falsy' }).isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('lessonId'));
const courseIdFilter = query('courseId').optional({ values: 'falsy' }).isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'));
const trainerIdFilter = query('trainerId').optional({ values: 'falsy' }).isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('trainerId'));
const createdAtFromFilter = query('createdAtFrom').optional({ values: 'falsy' }).isISO8601();
const createdAtToFilter = query('createdAtTo').optional({ values: 'falsy' }).isISO8601();

const filterChains = [lessonIdFilter, courseIdFilter, trainerIdFilter, createdAtFromFilter, createdAtToFilter];

export const timingObservationsValidation = {
  create: [
    body('lessonId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('lessonId')),
    body('courseId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId')),
    body('manualDurationSeconds')
      .isInt({ min: 1, max: MAX_TIMING_OBSERVATION_DURATION_SECONDS })
      .withMessage(`manualDurationSeconds must be between 1 and ${MAX_TIMING_OBSERVATION_DURATION_SECONDS} seconds.`)
      .toInt(),
    body('aiAssistedDurationSeconds')
      .isInt({ min: 1, max: MAX_TIMING_OBSERVATION_DURATION_SECONDS })
      .withMessage(`aiAssistedDurationSeconds must be between 1 and ${MAX_TIMING_OBSERVATION_DURATION_SECONDS} seconds.`)
      .toInt(),
    body('notes')
      .optional({ values: 'falsy' })
      .isString()
      .trim()
      .isLength({ max: MAX_TIMING_OBSERVATION_NOTES_LENGTH })
      .withMessage(VALIDATION_MESSAGES.MAX_LENGTH('notes', MAX_TIMING_OBSERVATION_NOTES_LENGTH)),
  ],

  list: [...paginationQueryValidators, ...filterChains],

  stats: filterChains,
};
