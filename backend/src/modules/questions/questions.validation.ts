import { QuestionCategory, QuestionDifficulty, QuestionStatus, QuestionType } from '@prisma/client';
import { body, query } from 'express-validator';

import {
  MAX_QUESTION_CORRECT_ANSWER_LENGTH,
  MAX_QUESTION_EXPLANATION_LENGTH,
  MAX_QUESTION_OPTION_TEXT_LENGTH,
  MAX_QUESTION_OPTIONS,
  MAX_QUESTION_STARTER_CODE_LENGTH,
  MAX_QUESTION_TITLE_LENGTH,
  MIN_QUESTION_OPTIONS,
} from '@/constants/assessment';
import { paginationQueryValidators } from '@/validators/common.validators';

// Factories, not shared chain instances — express-validator's `.optional()` mutates the chain's
// underlying builder in place and returns the SAME reference, so a bare shared const reused in
// both `create` and `update` (with `.optional()` tacked on only for update) would retroactively
// make `create`'s validation optional too (verified precedent: courses.validation.ts). Fields
// below that are optional identically at every use site stay plain consts.
const titleChain = () => body('title').trim().isLength({ min: 1, max: MAX_QUESTION_TITLE_LENGTH });
const categoryChain = () => body('category').isIn(Object.values(QuestionCategory)).withMessage('category must be valid.');
const difficultyChain = () => body('difficulty').isIn(Object.values(QuestionDifficulty)).withMessage('difficulty must be valid.');

// The remaining fields' presence/absence-per-type invariants (e.g. "options are required for
// MCQ-family types but forbidden for SHORT_ANSWER") are discriminated-union-shaped and enforced
// in questions.service.ts#assertTypeConditionalFields — these chains only validate the shape of
// whatever was actually sent.
const explanationChain = body('explanation')
  .optional({ values: 'null' })
  .isString()
  .isLength({ max: MAX_QUESTION_EXPLANATION_LENGTH });

const optionsChain = body('options')
  .optional()
  .isArray({ min: MIN_QUESTION_OPTIONS, max: MAX_QUESTION_OPTIONS })
  .withMessage(`options must be an array of between ${MIN_QUESTION_OPTIONS} and ${MAX_QUESTION_OPTIONS} items.`);
const optionTextChain = body('options.*.text').trim().isLength({ min: 1, max: MAX_QUESTION_OPTION_TEXT_LENGTH });
const optionIsCorrectChain = body('options.*.isCorrect').isBoolean().withMessage('isCorrect must be a boolean.');

const correctAnswersChain = body('correctAnswers')
  .optional()
  .isArray({ min: 1 })
  .withMessage('correctAnswers must be a non-empty array.');
const correctAnswerItemChain = body('correctAnswers.*').trim().isLength({ min: 1, max: MAX_QUESTION_CORRECT_ANSWER_LENGTH });

const starterCodeChain = body('starterCode').optional({ values: 'null' }).isString().isLength({ max: MAX_QUESTION_STARTER_CODE_LENGTH });
const languageChain = body('language').optional({ values: 'null' }).isString().trim().isLength({ max: 100 });

export const questionsValidation = {
  create: [
    titleChain(),
    body('type').isIn(Object.values(QuestionType)).withMessage('type must be valid.'),
    categoryChain(),
    difficultyChain(),
    explanationChain,
    optionsChain,
    optionTextChain,
    optionIsCorrectChain,
    correctAnswersChain,
    correctAnswerItemChain,
    starterCodeChain,
    languageChain,
  ],

  update: [
    titleChain().optional(),
    categoryChain().optional(),
    difficultyChain().optional(),
    explanationChain,
    optionsChain,
    optionTextChain,
    optionIsCorrectChain,
    correctAnswersChain,
    correctAnswerItemChain,
    starterCodeChain,
    languageChain,
  ],

  updateStatus: [body('status').isIn(Object.values(QuestionStatus)).withMessage('status must be valid.')],

  list: [
    ...paginationQueryValidators,
    query('category').optional({ values: 'falsy' }).isIn(Object.values(QuestionCategory)),
    query('difficulty').optional({ values: 'falsy' }).isIn(Object.values(QuestionDifficulty)),
    query('type').optional({ values: 'falsy' }).isIn(Object.values(QuestionType)),
    query('status').optional({ values: 'falsy' }).isIn(Object.values(QuestionStatus)),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt', 'title']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
