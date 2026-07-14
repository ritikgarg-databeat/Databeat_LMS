import type { QuestionCategory, QuestionDifficulty, QuestionStatus, QuestionType } from '@prisma/client';

export interface QuestionListFilters {
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  status?: QuestionStatus;
  search?: string;
}

export type QuestionSortField = 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';
