import { body } from 'express-validator';

import { MAX_QNA_COMMENT_LENGTH } from '@/constants/qna';
import { idParamValidator } from '@/validators/common.validators';

// express-validator chains for the qna-comments module's routes, keyed by handler name. Every
// chain below is only ever used bare (never both bare and `.optional()` at different call
// sites), so none of them need to be factory functions — see the module-wide note on
// express-validator's `.optional()` in-place-mutation bug (assessments.validation.ts /
// feedback_express_validator_optional_mutation).
export const qnaCommentsValidation = {
  create: [
    body('questionId').optional({ values: 'null' }).isUUID().withMessage('questionId must be a valid identifier.'),
    body('answerId').optional({ values: 'null' }).isUUID().withMessage('answerId must be a valid identifier.'),
    body('content')
      .trim()
      .isLength({ min: 1, max: MAX_QNA_COMMENT_LENGTH })
      .withMessage(`content must be between 1 and ${MAX_QNA_COMMENT_LENGTH} characters.`),
  ],

  remove: [idParamValidator],
};
