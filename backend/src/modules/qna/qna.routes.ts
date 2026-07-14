import { Router } from 'express';
import multer from 'multer';

import { ACCEPTED_QNA_ATTACHMENT_MIME_TYPES, MAX_QNA_ATTACHMENT_SIZE_BYTES } from '@/constants/qna';
import { authenticate } from '@/middleware/auth.middleware';
import { BadRequestError } from '@/utils/app-error';
import { idParamValidator } from '@/validators/common.validators';

import { QnaAnswersController } from './qna-answers.controller';
import { qnaAnswersValidation } from './qna-answers.validation';
import { QnaCommentsController } from './qna-comments.controller';
import { qnaCommentsValidation } from './qna-comments.validation';
import { QnaQuestionsController } from './qna-questions.controller';
import { qnaQuestionsValidation } from './qna-questions.validation';
import { QnaSearchController } from './qna-search.controller';
import { qnaSearchValidation } from './qna-search.validation';
import { QnaTagsController } from './qna-tags.controller';
import { qnaTagsValidation } from './qna-tags.validation';
import { QnaVotesController } from './qna-votes.controller';
import { qnaVotesValidation } from './qna-votes.validation';

/**
 * Route definitions for the qna module (Prompt 7 § PART 2 — Q&A Discussion Platform). Mounted
 * at `/qna` in src/routes/index.ts, giving full paths like `/api/v1/qna/questions`. This
 * top-level composer is the only file that wires actual Express routes for the six vertical
 * slices below (questions/answers/comments/votes/tags/search), each built independently by a
 * separate agent per this module's own README.md — every controller/validation import above
 * comes from a self-contained sibling file, never from another slice.
 *
 * Every route requires auth. RBAC beyond "authenticated" (ownership, TRAINER/SUPER_ADMIN-only
 * actions, visibility-based access) is enforced inside each slice's own service layer, not here
 * — mirrors the assessments/calendar modules' precedent from Prompt 6, since most of these
 * checks depend on data (question ownership, group/department membership), not just role.
 */
const router = Router();

/**
 * QnA-specific Multer instance — NOT the shared `upload` middleware, whose 200 MB lesson-file
 * cap is wrong here: any trainee can hit this route, and memoryStorage buffers the whole
 * stream BEFORE any service-layer check runs, so both the 10 MB size cap and the MIME
 * allowlist must be enforced by Multer itself (the service re-checks both as defense in
 * depth). A LIMIT_FILE_SIZE violation surfaces as a 400 via the MulterError branch in
 * error.middleware.ts.
 */
const qnaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_QNA_ATTACHMENT_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if ((ACCEPTED_QNA_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`Unsupported file type: ${file.mimetype}.`));
    }
  },
});

const questions = new QnaQuestionsController();
const answers = new QnaAnswersController();
const comments = new QnaCommentsController();
const votes = new QnaVotesController();
const tags = new QnaTagsController();
const search = new QnaSearchController();

router.use(authenticate);

// --- Questions ---
router.post('/questions', qnaQuestionsValidation.create, questions.create);
router.get('/questions', qnaQuestionsValidation.list, questions.list);
router.get('/questions/:id', idParamValidator, questions.getById);
router.put('/questions/:id', idParamValidator, qnaQuestionsValidation.update, questions.update);
router.delete('/questions/:id', idParamValidator, questions.remove);
router.patch('/questions/:id/status', idParamValidator, qnaQuestionsValidation.updateStatus, questions.updateStatus);
router.post('/questions/:id/attachments', idParamValidator, qnaUpload.single('file'), questions.uploadAttachment);
router.delete(
  '/questions/:id/attachments/:attachmentId',
  idParamValidator,
  qnaQuestionsValidation.removeAttachment,
  questions.removeAttachment,
);
router.get(
  '/questions/:id/attachments/:attachmentId/download',
  idParamValidator,
  qnaQuestionsValidation.downloadAttachment,
  questions.downloadAttachment,
);
// `:id` here is the QUESTION id (target answer id travels in the body as `answerId`) — see
// QnaAnswersController#verify's doc-comment for why this lives in the answers slice.
router.post('/questions/:id/verify-answer', idParamValidator, qnaAnswersValidation.verify, answers.verify);

// --- Answers ---
router.post('/answers', qnaAnswersValidation.create, answers.create);
router.put('/answers/:id', idParamValidator, qnaAnswersValidation.update, answers.update);
router.delete('/answers/:id', idParamValidator, answers.remove);
router.patch('/answers/:id/pin', idParamValidator, qnaAnswersValidation.pin, answers.pin);

// --- Comments ---
router.post('/comments', qnaCommentsValidation.create, comments.create);
router.delete('/comments/:id', qnaCommentsValidation.remove, comments.remove);

// --- Votes ---
router.post('/votes', qnaVotesValidation.toggle, votes.toggle);

// --- Tags ---
router.get('/tags', qnaTagsValidation.list, tags.list);

// --- Search ---
router.get('/search', qnaSearchValidation.search, search.search);

export default router;
