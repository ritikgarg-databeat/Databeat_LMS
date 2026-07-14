// Request/response DTOs (API-facing shapes) for the modules module.
export interface CreateModuleDto {
  courseId: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
}

export interface UpdateModuleDto {
  title?: string;
  description?: string | null;
  estimatedDurationMinutes?: number | null;
}

export interface UpdateModuleStatusDto {
  isPublished: boolean;
}

export interface ReorderModulesDto {
  courseId: string;
  orderedIds: string[];
}

export interface ListModulesQueryDto {
  courseId: string;
}
