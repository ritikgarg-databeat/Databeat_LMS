// API calls for the settings feature, built on the shared Axios client.
//
// Mirrors backend/src/modules/settings — user-level settings/theme/notification-preferences,
// avatar upload/delete, and (SUPER_ADMIN only) platform settings. Grouped into one `settingsApi`
// object the same way features/auth/services groups its own single-resource endpoints.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  NotificationPreferences,
  NotificationType,
  PlatformSettings,
  ThemePreference,
  UpdatePlatformSettingsPayload,
  UploadAvatarResult,
  UserSettings,
} from '../types';

export const settingsApi = {
  async getSettings(): Promise<UserSettings> {
    const { data } = await apiClient.get<ApiSuccessResponse<UserSettings>>('/settings');
    return data.data;
  },

  async updateTheme(theme: ThemePreference): Promise<{ theme: ThemePreference }> {
    const { data } = await apiClient.patch<ApiSuccessResponse<{ theme: ThemePreference }>>('/settings/theme', {
      theme,
    });
    return data.data;
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const { data } = await apiClient.get<ApiSuccessResponse<NotificationPreferences>>(
      '/settings/notification-preferences',
    );
    return data.data;
  },

  async updateNotificationPreferences(mutedTypes: NotificationType[]): Promise<NotificationPreferences> {
    const { data } = await apiClient.patch<ApiSuccessResponse<NotificationPreferences>>(
      '/settings/notification-preferences',
      { mutedTypes },
    );
    return data.data;
  },

  async uploadAvatar(file: File): Promise<UploadAvatarResult> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<ApiSuccessResponse<UploadAvatarResult>>('/settings/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  /** 204 No Content. */
  async deleteAvatar(): Promise<void> {
    await apiClient.delete('/settings/avatar');
  },

  /**
   * Streams the caller's own avatar bytes — NOT the `{success,message,data}` envelope every other
   * endpoint here returns — so the response is read as a `Blob`. The endpoint requires the
   * `Authorization` header (attached automatically by `apiClient`'s interceptor), which is why
   * callers can't just point an `<img src>` at it directly; see `useAuthenticatedAvatarUrl` in
   * ../hooks, which mirrors the classroom feature's `useAuthenticatedMediaUrl`.
   */
  async downloadAvatar(): Promise<Blob> {
    const { data } = await apiClient.get<Blob>('/settings/avatar', { responseType: 'blob' });
    return data;
  },

  /** SUPER_ADMIN only — the backend 403s for every other role. */
  async getPlatformSettings(): Promise<PlatformSettings> {
    const { data } = await apiClient.get<ApiSuccessResponse<PlatformSettings>>('/settings/platform');
    return data.data;
  },

  /** SUPER_ADMIN only — the backend 403s for every other role. */
  async updatePlatformSettings(payload: UpdatePlatformSettingsPayload): Promise<PlatformSettings> {
    const { data } = await apiClient.patch<ApiSuccessResponse<PlatformSettings>>('/settings/platform', payload);
    return data.data;
  },
};
