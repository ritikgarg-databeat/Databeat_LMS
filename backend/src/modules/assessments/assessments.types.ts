import type { AssessmentStatus } from '@prisma/client';

// Internal domain types for the assessments module.
export interface AssessmentListFilters {
  status?: AssessmentStatus;
  search?: string;
}

export type AssessmentSortField = 'createdAt' | 'title' | 'dueDate';
export type SortOrder = 'asc' | 'desc';

export interface AssessmentStats {
  totalAssessments: number;
  publishedAssessments: number;
  draftAssessments: number;
  pendingGradingCount: number;
  upcomingCount: number;
}

/** `GET /assessments/mine`'s per-item current-user attempt summary — `null` if not yet started. */
export interface MyAttemptSummary {
  status: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}
