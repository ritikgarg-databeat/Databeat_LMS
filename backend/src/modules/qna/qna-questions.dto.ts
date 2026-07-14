import type { QnaQuestionStatus, QnaVisibility } from '@prisma/client';

import type { QnaQuestionSortField } from './qna-questions.types';

// Request/response DTOs (API-facing shapes) for the qna-questions module.

/**
 * Body for `POST /qna/questions`. Exactly one of `groupId`/`departmentId` is required depending
 * on `visibility` (GROUP/DEPARTMENT respectively) and neither is allowed for ORGANIZATION —
 * enforced in qna-questions.service.ts, not here (see its `assertVisibilityRules`).
 */
export interface CreateQnaQuestionDto {
  title: string;
  description: string;
  /** Tag names, upserted by name into QnaTag (max `MAX_QNA_TAGS_PER_QUESTION`). */
  tags?: string[];
  visibility: QnaVisibility;
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
}

/**
 * Body for `PUT /qna/questions/:id`. Every field is optional (partial update). `undefined` means
 * "leave as-is"; `null` on a nullable relation field means "clear it" (mirrors
 * `UpdateCourseDto`/`courses.service.ts#update`'s connect-or-disconnect convention). If `tags` is
 * provided, it fully replaces the question's existing tag set (not a merge).
 */
export interface UpdateQnaQuestionDto {
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: QnaVisibility;
  groupId?: string | null;
  departmentId?: string | null;
  courseId?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
}

export interface UpdateQnaQuestionStatusDto {
  status: QnaQuestionStatus;
}

/**
 * Raw (string) query params for `GET /qna/questions` — mirrors
 * `ListNotificationsQueryDto`/`ListAssessmentsQueryDto`'s pattern of typing query DTOs as the
 * unparsed strings Express actually hands the controller.
 */
export interface ListQnaQuestionsQueryDto {
  page?: string;
  pageSize?: string;
  status?: QnaQuestionStatus;
  tag?: string;
  search?: string;
  courseId?: string;
  sortBy?: QnaQuestionSortField;
  /** `'true'` restricts to the caller's own questions — see `QnaQuestionListFilters.mine`. */
  mine?: string;
  /** `'true'` restricts to questions with no live answers — see `QnaQuestionListFilters.unanswered`. */
  unanswered?: string;
  /** `'true'` restricts to answered-but-unverified questions — see `QnaQuestionListFilters.pendingVerification`. */
  pendingVerification?: string;
}
