// TypeScript types and interfaces for the qna (Q&A Discussion Platform) feature.
//
// Mirrors backend/src/modules/qna exactly — questions, answers, comments, votes, tags, and
// cross-resource search all live under this one feature folder, the same way
// features/assessment/types groups questions/assessments/attempts together.

export type QnaVisibility = 'GROUP' | 'DEPARTMENT' | 'ORGANIZATION';

export type QnaQuestionStatus = 'OPEN' | 'SOLVED' | 'CLOSED';

/* -------------------------------------------------------------------------- */
/* Shared nested shapes                                                       */
/* -------------------------------------------------------------------------- */

export interface QnaUserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

/** Minimal `{id, title}` reference — reused for `QnaQuestionDetail.course/module/lesson` and for `QnaSearchResult.courses/lessons`. */
export interface QnaEntityRef {
  id: string;
  title: string;
}

/** A comment on either a question or an answer, as nested in `QnaQuestionDetail`/`QnaAnswer`. */
export interface QnaComment {
  id: string;
  content: string;
  author: QnaUserSummary;
  createdAt: string;
}

/** An attachment summary, as nested in `QnaQuestionDetail.attachments`. */
export interface QnaAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

/** Raw row shape returned by `POST /qna/questions/:id/attachments` — a few more fields than the nested `QnaAttachment` summary. */
export interface AttachmentUploadResult extends QnaAttachment {
  questionId: string;
  answerId: string | null;
  filePath: string;
  uploadedById: string;
}

/**
 * One answer to a question. The base shape is what's nested in `QnaQuestionDetail.answers`;
 * the create/update/pin/verify-answer responses return this same shape plus a few raw-row fields
 * that aren't present in the nested view — kept optional here rather than duplicated into a
 * separate type.
 */
export interface QnaAnswer {
  id: string;
  content: string;
  author: QnaUserSummary;
  isVerified: boolean;
  isPinned: boolean;
  verifiedBy: QnaUserSummary | null;
  verifiedAt: string | null;
  voteCount: number;
  myVote: boolean;
  comments: QnaComment[];
  createdAt: string;
  updatedAt: string;
  /** Present on create/update/pin/verify-answer responses only — absent when nested in `QnaQuestionDetail.answers`. */
  questionId?: string;
  authorId?: string;
  deletedAt?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

/** `GET /qna/questions` list item — lightweight, no `description`/`answers`/`comments`/`attachments`. */
export interface QnaQuestionListItem {
  id: string;
  title: string;
  status: QnaQuestionStatus;
  visibility: QnaVisibility;
  authorId: string;
  authorName: string;
  tags: string[];
  answersCount: number;
  hasVerifiedAnswer: boolean;
  voteCount: number;
  viewCount: number;
  createdAt: string;
}

/**
 * `GET /qna/questions/:id` — full detail, including nested answers/comments/attachments.
 * `answers` arrives pre-sorted server-side: pinned first, then verified, then oldest-first.
 * `comments` here are top-level question comments only (an answer's own comments live at
 * `QnaAnswer.comments`).
 */
export interface QnaQuestionDetail {
  id: string;
  title: string;
  description: string;
  status: QnaQuestionStatus;
  visibility: QnaVisibility;
  author: QnaUserSummary;
  course: QnaEntityRef | null;
  module: QnaEntityRef | null;
  lesson: QnaEntityRef | null;
  groupId: string | null;
  departmentId: string | null;
  tags: string[];
  viewCount: number;
  voteCount: number;
  myVote: boolean;
  attachments: QnaAttachment[];
  answers: QnaAnswer[];
  comments: QnaComment[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Body for `POST /qna/questions`. `groupId` is required (and only valid) when
 * `visibility === 'GROUP'`; `departmentId` is required (and only valid) when
 * `visibility === 'DEPARTMENT'` — enforced server-side.
 */
export interface CreateQuestionPayload {
  title: string;
  description: string;
  visibility: QnaVisibility;
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  tags?: string[];
}

/** Body for `PUT /qna/questions/:id` — every field optional (partial update). */
export interface UpdateQuestionPayload {
  title?: string;
  description?: string;
  visibility?: QnaVisibility;
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  tags?: string[];
}

export interface UpdateQuestionStatusPayload {
  status: QnaQuestionStatus;
}

export interface ListQuestionsParams {
  page?: number;
  pageSize?: number;
  status?: QnaQuestionStatus;
  tag?: string;
  search?: string;
  courseId?: string;
  sortBy?: 'newest' | 'votes';
  /** Only the caller's own questions — powers the trainee dashboard's "My Questions" widget. */
  mine?: boolean;
  /** Only questions with zero live answers — powers the trainer dashboard's "Unanswered" widget. */
  unanswered?: boolean;
  /** Only answered-but-unverified questions — powers the trainer dashboard's "Pending verification" widget. */
  pendingVerification?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Answers                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateAnswerPayload {
  questionId: string;
  content: string;
}

export interface UpdateAnswerPayload {
  content: string;
}

export interface PinAnswerPayload {
  isPinned: boolean;
}

/** Body for `POST /qna/questions/:id/verify-answer` — note the URL path uses the QUESTION id. */
export interface VerifyAnswerPayload {
  answerId: string;
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                   */
/* -------------------------------------------------------------------------- */

/** Exactly one of `questionId`/`answerId` must be provided — the backend 400s otherwise. */
export interface CreateCommentPayload {
  questionId?: string;
  answerId?: string;
  content: string;
}

/** `POST /qna/comments` response — a flat row, not the nested `QnaComment` shape. */
export interface CreateCommentResult {
  id: string;
  questionId: string | null;
  answerId: string | null;
  content: string;
  author: QnaUserSummary;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Votes                                                                      */
/* -------------------------------------------------------------------------- */

/** Exactly one of `questionId`/`answerId` must be provided — the backend 400s otherwise. */
export interface ToggleVotePayload {
  questionId?: string;
  answerId?: string;
}

/** `POST /qna/votes` is a TOGGLE, not a pure create — calling it again on the same target removes the vote. */
export interface VoteToggleResult {
  voted: boolean;
  voteCount: number;
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

/** `GET /qna/tags` item — also reused for `QnaSearchResult.tags`. */
export interface QnaTag {
  id: string;
  name: string;
  questionCount: number;
}

export interface ListTagsParams {
  search?: string;
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export interface SearchParams {
  q: string;
  limit?: number;
}

/** `QnaSearchResult.questions` item — narrower than `QnaQuestionListItem` (no `authorId`/`hasVerifiedAnswer`/`voteCount`/`viewCount`). */
export interface QnaSearchQuestionResult {
  id: string;
  title: string;
  status: QnaQuestionStatus;
  visibility: QnaVisibility;
  authorName: string;
  tags: string[];
  answersCount: number;
  createdAt: string;
}

export interface QnaSearchResult {
  questions: QnaSearchQuestionResult[];
  tags: QnaTag[];
  courses: QnaEntityRef[];
  lessons: QnaEntityRef[];
}
