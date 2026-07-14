import type { AuthUser } from '@/features/auth/types';
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  CreateUserPayload,
  Department,
  ExperienceLevelOption,
  ResetPasswordPayload,
  ResetPasswordResult,
  UpdateUserPayload,
  UserListParams,
} from '../types';

export const usersApi = {
  async list(params: UserListParams): Promise<PaginatedData<AuthUser>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<AuthUser>>>('/users', { params });
    return data.data;
  },

  async create(payload: CreateUserPayload): Promise<AuthUser> {
    const { data } = await apiClient.post<ApiSuccessResponse<AuthUser>>('/users', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<AuthUser> {
    const { data } = await apiClient.patch<ApiSuccessResponse<AuthUser>>(`/users/${id}`, payload);
    return data.data;
  },

  async deactivate(id: string): Promise<AuthUser> {
    const { data } = await apiClient.patch<ApiSuccessResponse<AuthUser>>(`/users/${id}/deactivate`);
    return data.data;
  },

  async reactivate(id: string): Promise<AuthUser> {
    const { data } = await apiClient.patch<ApiSuccessResponse<AuthUser>>(`/users/${id}/reactivate`);
    return data.data;
  },

  async resetPassword(id: string, payload: ResetPasswordPayload): Promise<ResetPasswordResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<ResetPasswordResult>>(
      `/users/${id}/reset-password`,
      payload,
    );
    return data.data;
  },
};

/**
 * Lightweight dropdown-population calls (large `pageSize` to fetch effectively "all" rows —
 * departments and experience levels are small, curated lists, never paginated in a picker).
 * The full management UI lives in features/departments and features/organization.
 */
export const departmentsApi = {
  async list(): Promise<Department[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<Department>>>('/departments', {
      params: { pageSize: 100, status: 'ACTIVE' },
    });
    return data.data.items;
  },
};

export const experienceLevelsApi = {
  async list(): Promise<ExperienceLevelOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<ExperienceLevelOption[]>>('/experience-levels');
    return data.data;
  },
};
