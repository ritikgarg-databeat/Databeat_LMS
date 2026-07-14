import type { DepartmentStatus } from '@prisma/client';

export interface DepartmentListFilters {
  status?: DepartmentStatus;
  search?: string;
}

export type DepartmentSortField = 'createdAt' | 'name';
export type SortOrder = 'asc' | 'desc';
