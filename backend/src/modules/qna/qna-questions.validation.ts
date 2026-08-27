import { QnaQuestionStatus, QnaVisibility } from '@prisma/client';
import { body, param, query } from 'express-validator';

import {
  MAX_QNA_QUESTION_DESCRIPTION_LENGTH,
  MAX_QNA_QUESTION_TITLE_LENGTH,
  MAX_QNA_TAG_NAME_LENGTH,
  MAX_QNA_TAGS_PER_QUESTION,
} from '@/constants/qna';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';
import { paginationQueryValidators } from '@/validators/common.validators';

// Factories, not shared chain instances — express-validator's `.optional()` mutates the chain's
// underlying builder in place and returns the SAME reference, so a shared const reused bare in
// `create` and as `.optional()` in `update` would retroactively make `create`'s validation
// optional too (verified in the courses module, see assessments.validation.ts for the same note).
const titleChain = () =>
  body('title')
    .trim()
    .isLength({ min: 1, max: MAX_QNA_QUESTION_TITLE_LENGTH })
    .withMessage(VALIDATION_MESSAGES.MAX_LENGTH('title', MAX_QNA_QUESTION_TITLE_LENGTH));
const descriptionChain = () =>
  body('description')
    .trim()
    .isLength({ min: 1, max: MAX_QNA_QUESTION_DESCRIPTION_LENGTH })
    .withMessage(VALIDATION_MESSAGES.MAX_LENGTH('description', MAX_QNA_QUESTION_DESCRIPTION_LENGTH));
const visibilityChain = () =>
  body('visibility').isIn(Object.values(QnaVisibility)).withMessage('visibility must be a valid value.');

// Always-optional chains — both `create` and `update` treat every one of these as optional, so
// it's safe to share a single instance (no use-site needs the bare/required form).
const tagsChain = body('tags')
  .optional()
  .isArray({ max: MAX_QNA_TAGS_PER_QUESTION })
  .withMessage(`tags must be an array of at most ${MAX_QNA_TAGS_PER_QUESTION} items.`);
const tagItemChain = body('tags.*')
  .isString()
  .trim()
  .isLength({ min: 1, max: MAX_QNA_TAG_NAME_LENGTH })
  .withMessage(`Each tag must be at most ${MAX_QNA_TAG_NAME_LENGTH} characters.`);
const groupIdChain = body('groupId')
  .optional({ values: 'null' })
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('groupId'));
const departmentIdChain = body('departmentId')
  .optional({ values: 'null' })
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('departmentId'));
const courseIdChain = body('courseId')
  .optional({ values: 'null' })
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId'));
const moduleIdChain = body('moduleId')
  .optional({ values: 'null' })
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('moduleId'));
const lessonIdChain = body('lessonId')
  .optional({ values: 'null' })
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('lessonId'));

const attachmentIdParamValidator = param('attachmentId')
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('attachmentId'));

const relationFieldChains = [
  tagsChain,
  tagItemChain,
  groupIdChain,
  departmentIdChain,
  courseIdChain,
  moduleIdChain,
  lessonIdChain,
];

// express-validator chains for the qna-questions module's routes, keyed by handler name. The
// `:id` param itself is validated at the routing layer via the shared `idParamValidator`
// (@/validators/common.validators) — every other module in this codebase applies it there
// (see e.g. assessments.routes.ts), not inside a module's own `*.validation.ts`.
export const qnaQuestionsValidation = {
  list: [
    ...paginationQueryValidators,
    query('status').optional({ values: 'falsy' }).isIn(Object.values(QnaQuestionStatus)),
    query('tag').optional().isString().trim().isLength({ max: MAX_QNA_TAG_NAME_LENGTH }),
    query('search').optional().isString().trim(),
    query('courseId').optional().isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('courseId')),
    query('sortBy').optional().isIn(['newest', 'votes']),
    query('mine').optional().isIn(['true', 'false']),
    query('unanswered').optional().isIn(['true', 'false']),
    query('pendingVerification').optional().isIn(['true', 'false']),
  ],

  create: [titleChain(), descriptionChain(), visibilityChain(), ...relationFieldChains],

  update: [
    titleChain().optional(),
    descriptionChain().optional(),
    visibilityChain().optional(),
    ...relationFieldChains,
  ],

  updateStatus: [body('status').isIn(Object.values(QnaQuestionStatus)).withMessage('status must be valid.')],

  removeAttachment: [attachmentIdParamValidator],

  downloadAttachment: [attachmentIdParamValidator],
};
