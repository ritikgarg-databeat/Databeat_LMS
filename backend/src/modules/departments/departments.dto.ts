import type { DepartmentStatus } from '@prisma/client';

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  description?: string | null;
}

export interface UpdateDepartmentStatusDto {
  status: DepartmentStatus;
}

export interface ListDepartmentsQueryDto {
  status?: DepartmentStatus;
  search?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}
