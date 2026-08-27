import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AddGroupMemberPayload,
  AddGroupMembersPayload,
  AddGroupMembersResult,
  AssignTrainerPayload,
  BulkImportSummary,
  CreateGroupPayload,
  DepartmentOption,
  DuplicateGroupPayload,
  ExperienceLevelOption,
  Group,
  GroupListParams,
  GroupMember,
  GroupMemberListParams,
  GroupStats,
  MyGroupOption,
  TraineeOption,
  TrainerOption,
  TransferGroupMemberPayload,
  UpdateGroupPayload,
  UpdateGroupStatusPayload,
} from '../types';

export const groupsApi = {
  async list(params: GroupListParams): Promise<PaginatedData<Group>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<Group>>>('/groups', { params });
    return data.data;
  },

  async create(payload: CreateGroupPayload): Promise<Group> {
    const { data } = await apiClient.post<ApiSuccessResponse<Group>>('/groups', payload);
    return data.data;
  },

  async getById(id: string): Promise<Group> {
    const { data } = await apiClient.get<ApiSuccessResponse<Group>>(`/groups/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateGroupPayload): Promise<Group> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Group>>(`/groups/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateGroupStatusPayload): Promise<Group> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Group>>(`/groups/${id}/status`, payload);
    return data.data;
  },

  async assignTrainer(id: string, payload: AssignTrainerPayload): Promise<Group> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Group>>(`/groups/${id}/trainer`, payload);
    return data.data;
  },

  async duplicate(id: string, payload: DuplicateGroupPayload): Promise<Group> {
    const { data } = await apiClient.post<ApiSuccessResponse<Group>>(`/groups/${id}/duplicate`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/groups/${id}`);
  },

  async stats(): Promise<GroupStats> {
    const { data } = await apiClient.get<ApiSuccessResponse<GroupStats>>('/groups/stats');
    return data.data;
  },

  /**
   * The current user's own group memberships — id/name/code only. Unlike `list()` above (which
   * the backend restricts to Trainer/Super-Admin), any authenticated role can call this — it
   * exists so a Trainee can pick one of their own groups (e.g. the Q&A "Ask Question" form's
   * GROUP-visibility picker) without needing the full-org group list.
   */
  async mine(): Promise<MyGroupOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<MyGroupOption[]>>('/groups/mine');
    return data.data;
  },
};

export const groupMembersApi = {
  async list(groupId: string, params: GroupMemberListParams): Promise<PaginatedData<GroupMember>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<GroupMember>>>(
      `/groups/${groupId}/members`,
      { params },
    );
    return data.data;
  },

  async add(groupId: string, payload: AddGroupMemberPayload): Promise<GroupMember> {
    const { data } = await apiClient.post<ApiSuccessResponse<GroupMember>>(
      `/groups/${groupId}/members`,
      payload,
    );
    return data.data;
  },

  async addMany(groupId: string, payload: AddGroupMembersPayload): Promise<AddGroupMembersResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<AddGroupMembersResult>>(
      `/groups/${groupId}/members/bulk`,
      payload,
    );
    return data.data;
  },

  async remove(groupId: string, userId: string): Promise<void> {
    await apiClient.delete(`/groups/${groupId}/members/${userId}`);
  },

  async transfer(groupId: string, userId: string, payload: TransferGroupMemberPayload): Promise<void> {
    await apiClient.post(`/groups/${groupId}/members/${userId}/transfer`, payload);
  },

  async bulkImport(groupId: string, file: File): Promise<BulkImportSummary> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<ApiSuccessResponse<BulkImportSummary>>(
      `/groups/${groupId}/members/bulk-import`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },
};

/**
 * Lightweight dropdown/checklist-population calls, feature-local to groups — a little
 * duplication with features/departments and features/users is expected here (see
 * features/users/services/index.ts for the same pattern). Each is capped at the backend's
 * own page-size ceiling (100), the same convention used everywhere else in this codebase for
 * "effectively all" lookups.
 */
export const departmentOptionsApi = {
  async list(): Promise<DepartmentOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<DepartmentOption>>>(
      '/departments',
      {
        params: { pageSize: 100, status: 'ACTIVE' },
      },
    );
    return data.data.items;
  },
};

export const experienceLevelOptionsApi = {
  async list(): Promise<ExperienceLevelOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<ExperienceLevelOption[]>>('/experience-levels');
    return data.data;
  },
};

export const trainerOptionsApi = {
  async list(): Promise<TrainerOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<TrainerOption>>>('/users', {
      params: { role: 'TRAINER', pageSize: 100 },
    });
    return data.data.items;
  },
};

export const traineeOptionsApi = {
  async list(): Promise<TraineeOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<TraineeOption>>>('/users', {
      params: { role: 'TRAINEE', pageSize: 100 },
    });
    return data.data.items;
  },
};
