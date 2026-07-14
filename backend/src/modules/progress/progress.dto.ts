import type { LessonProgressStatus } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the progress module.

// Body for `POST /lessons/:id/progress` (lesson-scoped upsert — see progress.controller.ts).
export interface UpsertLessonProgressDto {
  status?: LessonProgressStatus;
  timeSpentSecondsDelta?: number;
}

export interface ListContinueLearningQueryDto {
  limit?: string;
}
