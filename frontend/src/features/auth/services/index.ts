import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  AuthUser,
  ChangePasswordPayload,
  ChangePasswordResult,
  ForgotPasswordPayload,
  LoginPayload,
  LoginResult,
} from '../types';

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResult> {
    // `payload` (email/password/rememberMe) is forwarded as-is — the backend reads `rememberMe`
    // to extend the refresh-token cookie's lifetime (30 days vs ~7 by default).
    const { data } = await apiClient.post<ApiSuccessResponse<LoginResult>>('/auth/login', payload);
    return data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async refresh(): Promise<{ accessToken: string }> {
    const { data } = await apiClient.post<ApiSuccessResponse<{ accessToken: string }>>('/auth/refresh');
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiSuccessResponse<AuthUser>>('/auth/me');
    return data.data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<ChangePasswordResult>>(
      '/auth/change-password',
      payload,
    );
    return data.data;
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    await apiClient.post('/auth/forgot-password', payload);
  },
};
