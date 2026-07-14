import { body } from 'express-validator';

// Local cap on answer content length — QnaAnswer.content is @db.Text (unbounded) at the DB
// layer, so this is purely an API-level guard against pathological payloads. Kept local to this
// module rather than reusing the unrelated `MAX_ANSWER_TEXT_LENGTH` in constants/assessment.ts
// (that one guards AssessmentAnswer.textAnswer, a different domain entirely).
const MAX_QNA_ANSWER_CONTENT_LENGTH = 20000;

// Referenced bare (no `.optional()` anywhere) — content is always required on both `create` and
// `update` — so a single shared instance is safe here. Contrast with the factory-function fix
// (`() => body(...)`) needed when a chain is reused bare in one place and `.optional()`'d in
// another (see calendar.validation.ts / assessments.validation.ts for that pattern and why it
// matters — express-validator's `.optional()` mutates the chain's underlying builder in place).
const contentChain = body('content')
  .trim()
  .isLength({ min: 1, max: MAX_QNA_ANSWER_CONTENT_LENGTH })
  .withMessage(`content is required and must be at most ${MAX_QNA_ANSWER_CONTENT_LENGTH} characters.`);

const questionIdChain = body('questionId').isUUID().withMessage('questionId must be a valid identifier.');
const answerIdChain = body('answerId').isUUID().withMessage('answerId must be a valid identifier.');
const isPinnedChain = body('isPinned').isBoolean().withMessage('isPinned must be a boolean.').toBoolean();

/**
 * express-validator chains for the qna-answers module's routes, keyed by handler name.
 *
 * The `:id`-param UUID check (answer id for update/pin, question id for verify) is applied by
 * the orchestrating qna.routes.ts via the shared `idParamValidator` from
 * `@/validators/common.validators`, exactly like calendar.routes.ts / notifications.routes.ts
 * already do for their own `:id`-based routes — this file only validates request bodies.
 * `remove` has no body to validate, so it has no entry here (same precedent as
 * calendar.validation.ts, which has no `remove` key either).
 */
export const qnaAnswersValidation = {
  create: [questionIdChain, contentChain],
  update: [contentChain],
  pin: [isPinnedChain],
  verify: [answerIdChain],
};
