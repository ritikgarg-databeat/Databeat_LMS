import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  CreateDepartmentPayload,
  Department,
  DepartmentListParams,
  UpdateDepartmentPayload,
  UpdateDepartmentStatusPayload,
} from '../types';

export const departmentsApi = {
  async list(params: DepartmentListParams): Promise<PaginatedData<Department>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<Department>>>('/departments', {
      params,
    });
    return data.data;
  },

  async create(payload: CreateDepartmentPayload): Promise<Department> {
    const { data } = await apiClient.post<ApiSuccessResponse<Department>>('/departments', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateDepartmentPayload): Promise<Department> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Department>>(`/departments/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateDepartmentStatusPayload): Promise<Department> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Department>>(
      `/departments/${id}/status`,
      payload,
    );
    return data.data;
  },
};
