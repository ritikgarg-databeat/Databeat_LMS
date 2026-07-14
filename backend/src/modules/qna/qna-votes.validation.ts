import { body } from 'express-validator';

// express-validator chains for the qna-votes module's routes, keyed by handler name. Both
// chains below are only ever used bare (never both bare and `.optional()` at different call
// sites), so neither needs to be a factory function — see the module-wide note on
// express-validator's `.optional()` in-place-mutation bug (assessments.validation.ts /
// feedback_express_validator_optional_mutation).
export const qnaVotesValidation = {
  toggle: [
    body('questionId').optional({ values: 'null' }).isUUID().withMessage('questionId must be a valid identifier.'),
    body('answerId').optional({ values: 'null' }).isUUID().withMessage('answerId must be a valid identifier.'),
  ],
};
