import type { NotificationType } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the notifications module.
export interface ListNotificationsQueryDto {
  page?: string;
  pageSize?: string;
  unreadOnly?: string;
}

/**
 * Input to `notificationsService.notify()` — the sole intended cross-module entry point into
 * this service (mirrors `auditLogService.record()`'s role as a shared singleton other modules
 * call directly, see ARCHITECTURE.md §3.1).
 */
export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/** Request body for `POST /notifications/announcements` (TRAINER/SUPER_ADMIN only). */
export interface CreateAnnouncementDto {
  groupId: string;
  title?: string;
  message: string;
}
