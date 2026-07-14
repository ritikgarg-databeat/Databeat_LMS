import type { Role } from '@prisma/client';

export interface UserListFilters {
  role?: Role;
  departmentId?: string;
  experienceLevelId?: string;
  isActive?: boolean;
  search?: string;
}

export type UserSortField = 'createdAt' | 'firstName' | 'lastLogin';
export type SortOrder = 'asc' | 'desc';
