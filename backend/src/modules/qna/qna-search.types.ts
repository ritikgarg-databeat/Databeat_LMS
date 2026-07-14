import type { QnaQuestionStatus, QnaVisibility } from '@prisma/client';

// Internal domain types for the qna-search module.

/** Per-category result cap, mirroring APP_CONFIG's page-size default/max pattern. */
export const DEFAULT_SEARCH_LIMIT_PER_CATEGORY = 10;
export const MAX_SEARCH_LIMIT_PER_CATEGORY = 25;

export interface SearchQuestionResult {
  id: string;
  title: string;
  status: QnaQuestionStatus;
  visibility: QnaVisibility;
  authorName: string;
  tags: string[];
  answersCount: number;
  createdAt: Date;
}

export interface SearchTagResult {
  id: string;
  name: string;
  questionCount: number;
}

export interface SearchCourseResult {
  id: string;
  title: string;
}

export interface SearchLessonResult {
  id: string;
  title: string;
}

export interface SearchResult {
  questions: SearchQuestionResult[];
  tags: SearchTagResult[];
  courses: SearchCourseResult[];
  lessons: SearchLessonResult[];
}
