import type { AuthUser } from '@/features/auth/types';
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

export interface UpdateOwnProfilePayload {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
}

export const profileApi = {
  async updateOwnProfile(payload: UpdateOwnProfilePayload): Promise<AuthUser> {
    const { data } = await apiClient.patch<ApiSuccessResponse<AuthUser>>('/users/me', payload);
    return data.data;
  },
};
