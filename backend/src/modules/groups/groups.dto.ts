import type { GroupStatus } from '@prisma/client';

export interface CreateGroupDto {
  name: string;
  code: string;
  departmentId: string;
  experienceLevelId?: string;
  trainerId?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
}

// `trainerId` is deliberately absent — reassignment goes through the dedicated
// `PATCH /:id/trainer` endpoint so it audits as GROUP_TRAINER_ASSIGNED, not GROUP_UPDATED.
export interface UpdateGroupDto {
  name?: string;
  code?: string;
  departmentId?: string;
  experienceLevelId?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  capacity?: number | null;
}

export interface UpdateGroupStatusDto {
  status: GroupStatus;
}

export interface AssignTrainerDto {
  trainerId: string | null;
}

export interface DuplicateGroupDto {
  name: string;
  code: string;
}

export interface ListGroupsQueryDto {
  page?: string;
  pageSize?: string;
  status?: GroupStatus;
  departmentId?: string;
  experienceLevelId?: string;
  trainerId?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: string;
  sortOrder?: string;
}
