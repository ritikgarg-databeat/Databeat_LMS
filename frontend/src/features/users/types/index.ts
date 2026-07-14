import type { Role } from '@/constants/roles';

export type SortField = 'createdAt' | 'firstName' | 'lastLogin';
export type SortOrder = 'asc' | 'desc';

export interface UserListFilters {
  departmentId?: string;
  experienceLevelId?: string;
  isActive?: boolean;
  search?: string;
}

export interface UserListParams extends UserListFilters {
  role: Role;
  page: number;
  pageSize: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string;
  experienceLevelId?: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  experienceLevelId?: string | null;
}

export interface ResetPasswordPayload {
  newPassword?: string;
}

export interface ResetPasswordResult {
  temporaryPassword?: string;
}

/** Minimal shape for populating dropdowns — see features/departments and features/organization for the full entity. */
export interface Department {
  id: string;
  name: string;
}

/** Minimal shape for populating dropdowns — see features/organization for the full entity. */
export interface ExperienceLevelOption {
  id: string;
  name: string;
  code: string;
}
