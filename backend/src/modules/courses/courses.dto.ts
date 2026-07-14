import type { CourseDifficulty, CourseStatus } from '@prisma/client';

export interface CreateCourseDto {
  title: string;
  description?: string;
  thumbnail?: string;
  departmentId?: string;
  experienceLevelId?: string;
  estimatedDurationMinutes?: number;
  difficulty?: CourseDifficulty;
}

// `status` is deliberately absent — a course always starts DRAFT (see coursesService.create)
// and only ever changes via the dedicated `PATCH /:id/status` endpoint so it audits as
// COURSE_STATUS_CHANGED, not COURSE_UPDATED.
export interface UpdateCourseDto {
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  departmentId?: string | null;
  experienceLevelId?: string | null;
  estimatedDurationMinutes?: number | null;
  difficulty?: CourseDifficulty;
}

export interface UpdateCourseStatusDto {
  status: CourseStatus;
}

export interface DuplicateCourseDto {
  title: string;
}

export interface AssignGroupDto {
  groupId: string;
}

export interface ListCoursesQueryDto {
  page?: string;
  pageSize?: string;
  status?: CourseStatus;
  difficulty?: CourseDifficulty;
  departmentId?: string;
  experienceLevelId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}
