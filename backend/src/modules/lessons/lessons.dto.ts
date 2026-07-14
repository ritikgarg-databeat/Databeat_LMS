import type { ResourceType } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the lessons module.
export interface CreateLessonDto {
  moduleId: string;
  title: string;
  description?: string;
  type: ResourceType;
  estimatedDurationMinutes?: number;
}

export interface UpdateLessonDto {
  title?: string;
  description?: string | null;
  type?: ResourceType;
  estimatedDurationMinutes?: number | null;
}

export interface UpdateLessonStatusDto {
  isPublished: boolean;
}

export interface ReorderLessonsDto {
  moduleId: string;
  orderedIds: string[];
}

export interface ListLessonsQueryDto {
  moduleId: string;
}
