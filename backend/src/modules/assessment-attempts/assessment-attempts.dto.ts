import type { AssessmentAttemptStatus, AssessmentIntegrityEventType } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the assessment-attempts module.

/**
 * Body for `PUT /mine/answers/:assessmentQuestionId`. Which field is meaningful depends on the
 * target question's `snapshotType` (see assessment-attempts.service.ts#saveAnswer) —
 * `selectedOptionIds` for the option-based types, `textAnswer` for the rest (FILE_UPLOAD is
 * rejected on this endpoint entirely, routed to the dedicated upload endpoint instead).
 */
export interface SaveAnswerDto {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

/** Body for `PATCH /:attemptId/answers/:answerId/grade` — Trainer/Super-Admin only. */
export interface GradeAnswerDto {
  marksAwarded: number;
  isCorrect?: boolean;
}

/** Query for `GET /` (the grading queue / results overview) — Trainer/Super-Admin only. */
export interface ListAttemptsQueryDto {
  page?: string;
  pageSize?: string;
  status?: AssessmentAttemptStatus;
}

export interface RecordIntegrityEventDto {
  type: AssessmentIntegrityEventType;
  occurredAt?: string;
}
