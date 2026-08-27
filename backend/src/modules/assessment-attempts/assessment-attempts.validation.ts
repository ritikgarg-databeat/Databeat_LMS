import { AssessmentAttemptStatus, AssessmentIntegrityEventType } from '@prisma/client';
import { body, param, query } from 'express-validator';

import { MAX_ANSWER_TEXT_LENGTH } from '@/constants/assessment';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// Every param/body chain below is only ever used bare (never both bare and `.optional()` at
// different call sites), so none of them need to be factory functions — see the module-wide
// note on express-validator's `.optional()` in-place-mutation bug (CLAUDE.md / feedback notes).
const assessmentQuestionIdParamValidator = param('assessmentQuestionId')
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('assessmentQuestionId'));

const attemptIdParamValidator = param('attemptId')
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('attemptId'));

const answerIdParamValidator = param('answerId')
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('answerId'));

export const assessmentAttemptsValidation = {
  // `PUT /mine/answers/:assessmentQuestionId` — shape depends on the target question's
  // snapshotType (enforced in assessment-attempts.service.ts#saveAnswer), so both fields are
  // optional here; at most one is ever relevant for a given question.
  saveAnswer: [
    assessmentQuestionIdParamValidator,
    body('selectedOptionIds')
      .optional({ values: 'null' })
      .isArray()
      .withMessage('selectedOptionIds must be an array.'),
    body('selectedOptionIds.*')
      .isUUID()
      .withMessage('Each selectedOptionIds entry must be a valid identifier.'),
    body('textAnswer')
      .optional({ values: 'null' })
      .isString()
      .isLength({ min: 1, max: MAX_ANSWER_TEXT_LENGTH })
      .withMessage(`textAnswer must be between 1 and ${MAX_ANSWER_TEXT_LENGTH} characters.`),
  ],

  uploadAnswer: [assessmentQuestionIdParamValidator],

  integrityEvent: [
    body('type').isIn(Object.values(AssessmentIntegrityEventType)).withMessage('type is invalid.'),
    body('occurredAt').optional().isISO8601().toDate(),
  ],

  listAttempts: [
    ...paginationQueryValidators,
    query('status')
      .optional({ values: 'falsy' })
      .isIn(Object.values(AssessmentAttemptStatus))
      .withMessage('status must be valid.'),
  ],

  attemptDetail: [attemptIdParamValidator],

  gradeAnswer: [
    attemptIdParamValidator,
    answerIdParamValidator,
    body('marksAwarded').isFloat({ min: 0 }).withMessage('marksAwarded must be a number >= 0.').toFloat(),
    body('isCorrect').optional().isBoolean().withMessage('isCorrect must be a boolean.').toBoolean(),
  ],
};
