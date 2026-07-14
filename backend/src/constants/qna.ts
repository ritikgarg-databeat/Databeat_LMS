/** Length/size limits for the Q&A Discussion Platform (Prompt 7 § PART 2). */
export const MAX_QNA_QUESTION_TITLE_LENGTH = 200;
export const MAX_QNA_QUESTION_DESCRIPTION_LENGTH = 10000;
export const MAX_QNA_ANSWER_LENGTH = 10000;
export const MAX_QNA_COMMENT_LENGTH = 2000;
export const MAX_QNA_TAG_NAME_LENGTH = 50;
export const MAX_QNA_TAGS_PER_QUESTION = 5;

/** Mirrors `ACCEPTED_LESSON_MIME_TYPES`'s pattern (src/constants/file-types.ts, Prompt 5) —
 * enforced by the qna-specific Multer instance's fileFilter in qna.routes.ts, and re-checked
 * in the service layer as defense in depth. */
export const ACCEPTED_QNA_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip',
] as const;

export const MAX_QNA_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
