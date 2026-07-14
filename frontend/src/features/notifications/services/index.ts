// API calls for the notifications feature, built on the shared Axios client.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AnnouncementResult,
  CreateAnnouncementPayload,
  Notification,
  NotificationListParams,
} from '../types';

export const notificationsApi = {
  /**
   * IMPORTANT: this call has a server-side side effect — it lazily generates
   * `ASSESSMENT_DEADLINE_APPROACHING` reminders on every invocation (no separate "check
   * reminders" endpoint exists; see backend/src/modules/notifications/README.md). Refetching
   * this periodically is the intended way new reminders surface, not an anti-pattern to avoid.
   */
  async list(params: NotificationListParams): Promise<PaginatedData<Notification>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<Notification>>>('/notifications', {
      params,
    });
    return data.data;
  },

  /** Unwraps the backend's `{count}` envelope — callers just want the number. */
  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<ApiSuccessResponse<{ count: number }>>(
      '/notifications/unread-count',
    );
    return data.data.count;
  },

  async markRead(id: string): Promise<Notification> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Notification>>(`/notifications/${id}/read`);
    return data.data;
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
  },

  /** Owner-only hard delete — mirrors the backend's `DELETE /notifications/:id`. */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },

  /** TRAINER/SUPER_ADMIN broadcast to every trainee in a group; returns how many were notified. */
  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<AnnouncementResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<AnnouncementResult>>(
      '/notifications/announcements',
      payload,
    );
    return data.data;
  },
};
