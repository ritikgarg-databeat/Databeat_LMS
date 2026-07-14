// Request/response DTOs (API-facing shapes) for the qna-comments module.

/**
 * Body for `POST /qna/comments`. Exactly one of `questionId`/`answerId` must be set — the XOR
 * relationship across two independently-optional fields can't be expressed by express-validator
 * chains, so it's enforced in qna-comments.service.ts#create instead (see its `resolveTarget`).
 */
export interface CreateCommentDto {
  questionId?: string;
  answerId?: string;
  content: string;
}

/** Shape returned by `POST /qna/comments` — the created comment with a minimal author view. */
export interface CommentView {
  id: string;
  questionId: string | null;
  answerId: string | null;
  content: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
}
