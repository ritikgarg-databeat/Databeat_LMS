import type { AssessmentStatus } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the assessments module.

// `status` is deliberately absent — an assessment always starts DRAFT (see
// assessments.service.ts's `create`) and only ever changes via the dedicated
// `PATCH /:id/status` endpoint so it audits as ASSESSMENT_STATUS_CHANGED, not ASSESSMENT_UPDATED.
export interface CreateAssessmentDto {
  title: string;
  description?: string;
  durationMinutes: number;
  passingPercentage: number;
  availableFrom?: string;
  dueDate?: string;
  instructions?: string;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerWrongAnswer?: number;
  randomizeQuestions?: boolean;
  showResultImmediately?: boolean;
}

export interface UpdateAssessmentDto {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  passingPercentage?: number;
  availableFrom?: string | null;
  dueDate?: string | null;
  instructions?: string | null;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerWrongAnswer?: number | null;
  randomizeQuestions?: boolean;
  showResultImmediately?: boolean;
}

export interface UpdateAssessmentStatusDto {
  status: AssessmentStatus;
}

export interface DuplicateAssessmentDto {
  title: string;
}

export interface AssignGroupDto {
  groupId: string;
}

export interface AddAssessmentQuestionDto {
  questionId: string;
  marks: number;
}

export interface UpdateAssessmentQuestionDto {
  marks: number;
}

export interface ReorderAssessmentQuestionsDto {
  orderedIds: string[];
}

export interface ListAssessmentsQueryDto {
  page?: string;
  pageSize?: string;
  status?: AssessmentStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}
