import { AssessmentStatus } from '@prisma/client';
import { body, param, query } from 'express-validator';

import {
  MAX_ASSESSMENT_DESCRIPTION_LENGTH,
  MAX_ASSESSMENT_DURATION_MINUTES,
  MAX_ASSESSMENT_INSTRUCTIONS_LENGTH,
  MAX_ASSESSMENT_TITLE_LENGTH,
  MAX_NEGATIVE_MARKS_PER_WRONG_ANSWER,
  MAX_PASSING_PERCENTAGE,
  MAX_QUESTION_MARKS,
  MIN_ASSESSMENT_DURATION_MINUTES,
  MIN_NEGATIVE_MARKS_PER_WRONG_ANSWER,
  MIN_PASSING_PERCENTAGE,
  MIN_QUESTION_MARKS,
} from '@/constants/assessment';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// Factories, not shared chain instances — express-validator's `.optional()` mutates the
// chain's underlying builder in place and returns the SAME reference, so a shared const reused
// bare in `create` and as `.optional()` in `update` would retroactively make `create`'s
// validation optional too (verified in the courses module — see courses.validation.ts).
const titleChain = () => body('title').trim().isLength({ min: 1, max: MAX_ASSESSMENT_TITLE_LENGTH });
const durationMinutesChain = () =>
  body('durationMinutes').isInt({ min: MIN_ASSESSMENT_DURATION_MINUTES, max: MAX_ASSESSMENT_DURATION_MINUTES }).toInt();
const passingPercentageChain = () =>
  body('passingPercentage').isInt({ min: MIN_PASSING_PERCENTAGE, max: MAX_PASSING_PERCENTAGE }).toInt();
const marksChain = () => body('marks').isInt({ min: MIN_QUESTION_MARKS, max: MAX_QUESTION_MARKS }).toInt();

// Always-optional chains — both `create` and `update` use `.optional()`, so it's safe to share
// a single instance since no use-site needs the bare/required form (see courses.validation.ts's
// `descriptionChain`/`thumbnailChain` for the same reasoning).
const descriptionChain = body('description').optional({ values: 'null' }).isString().isLength({ max: MAX_ASSESSMENT_DESCRIPTION_LENGTH });
const instructionsChain = body('instructions')
  .optional({ values: 'null' })
  .isString()
  .isLength({ max: MAX_ASSESSMENT_INSTRUCTIONS_LENGTH });
// `values: 'null'` (not 'falsy') — an explicit `null` must still pass through to clear the
// field on update, mirroring courses.validation.ts's capacityChain fix.
const availableFromChain = body('availableFrom').optional({ values: 'null' }).isISO8601().withMessage('availableFrom must be a valid date.');
const dueDateChain = body('dueDate').optional({ values: 'null' }).isISO8601().withMessage('dueDate must be a valid date.');
const negativeMarkingEnabledChain = body('negativeMarkingEnabled').optional().isBoolean().toBoolean();
const negativeMarksPerWrongAnswerChain = body('negativeMarksPerWrongAnswer')
  .optional({ values: 'null' })
  .isFloat({ min: MIN_NEGATIVE_MARKS_PER_WRONG_ANSWER, max: MAX_NEGATIVE_MARKS_PER_WRONG_ANSWER })
  .toFloat();
const randomizeQuestionsChain = body('randomizeQuestions').optional().isBoolean().toBoolean();
const showResultImmediatelyChain = body('showResultImmediately').optional().isBoolean().toBoolean();

const groupIdParamValidator = param('groupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'));
const aqIdParamValidator = param('aqId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('aqId'));

const configFieldChains = [
  descriptionChain,
  availableFromChain,
  dueDateChain,
  instructionsChain,
  negativeMarkingEnabledChain,
  negativeMarksPerWrongAnswerChain,
  randomizeQuestionsChain,
  showResultImmediatelyChain,
];

export const assessmentsValidation = {
  list: [
    ...paginationQueryValidators,
    query('status').optional({ values: 'falsy' }).isIn(Object.values(AssessmentStatus)),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt', 'title', 'dueDate']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],

  create: [titleChain(), durationMinutesChain(), passingPercentageChain(), ...configFieldChains],

  update: [titleChain().optional(), durationMinutesChain().optional(), passingPercentageChain().optional(), ...configFieldChains],

  updateStatus: [body('status').isIn(Object.values(AssessmentStatus)).withMessage('status must be valid.')],

  duplicate: [titleChain()],

  assignGroup: [body('groupId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'))],

  unassignGroup: [groupIdParamValidator],

  addQuestion: [body('questionId').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('questionId')), marksChain()],

  updateQuestion: [aqIdParamValidator, marksChain()],

  removeQuestion: [aqIdParamValidator],

  reorderQuestions: [
    body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array.'),
    body('orderedIds.*').isUUID().withMessage('Each id in orderedIds must be a valid UUID.'),
  ],
};
