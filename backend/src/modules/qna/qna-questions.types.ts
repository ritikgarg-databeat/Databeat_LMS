import type { QnaQuestionStatus } from '@prisma/client';

// Internal domain types for the qna-questions module.

export interface QnaQuestionListFilters {
  status?: QnaQuestionStatus;
  /** Exact tag name match (trimmed, case-sensitive — mirrors how tag names are stored at create/update time). */
  tag?: string;
  /** ILIKE search across `title`/`description`. */
  search?: string;
  courseId?: string;
  /** Restricts to the calling actor's own questions — powers the trainee dashboard's "My
   * Questions" widget (Prompt 7 § DASHBOARD INTEGRATION). Applied by actor id, never a raw
   * `authorId` query param, so a caller can never list another user's questions this way. */
  mine?: boolean;
  /** Restricts to questions with zero non-deleted answers — powers the trainer dashboard's
   * "Unanswered questions" widget (Prompt 7 § DASHBOARD INTEGRATION). */
  unanswered?: boolean;
  /** Restricts to questions with at least one non-deleted answer but no verified one — powers
   * the trainer dashboard's "Pending verification" widget. Mutually exclusive with `unanswered`
   * in practice (an unanswered question has nothing to verify) but not enforced — combining
   * them just yields an empty result. */
  pendingVerification?: boolean;
}

export type QnaQuestionSortField = 'newest' | 'votes';
