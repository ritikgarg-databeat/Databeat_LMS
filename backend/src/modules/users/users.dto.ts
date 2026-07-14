import type { Role } from '@prisma/client';

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string;
  experienceLevelId?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  experienceLevelId?: string | null;
}

export interface UpdateOwnProfileDto {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
}

export interface ResetPasswordDto {
  newPassword?: string;
}

export interface ResetPasswordResponseDto {
  temporaryPassword?: string;
}

export interface ChangeRoleDto {
  role: Role;
}

export interface ListUsersQueryDto {
  role?: Role;
  departmentId?: string;
  experienceLevelId?: string;
  isActive?: string;
  search?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}
