import type { CourseDifficulty, CourseStatus } from '@prisma/client';

export interface CourseListFilters {
  status?: CourseStatus;
  difficulty?: CourseDifficulty;
  departmentId?: string;
  experienceLevelId?: string;
  search?: string;
}

export type CourseSortField = 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface CourseStats {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  assignedGroupsCount: number;
  activeLearners: number;
}
