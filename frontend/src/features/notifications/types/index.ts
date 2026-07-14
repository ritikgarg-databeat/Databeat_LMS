// TypeScript types and interfaces for the notifications feature.
//
// Mirrors the backend's Notification model (backend/src/prisma/schema.prisma) and
// notifications.dto.ts.

export type NotificationType =
  | 'ASSESSMENT_ASSIGNED'
  | 'ASSESSMENT_DEADLINE_APPROACHING'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_UPDATED'
  | 'QNA_ANSWER_POSTED'
  | 'QNA_ANSWER_VERIFIED'
  | 'COURSE_ASSIGNED'
  | 'TRAINER_ANNOUNCEMENT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  /**
   * Lightweight polymorphic reference (e.g. "assessment" / "calendar_event") for building a
   * frontend deep-link — NOT a DB foreign key, so it survives the referenced row being
   * hard-deleted (see backend schema.prisma#Notification doc comment).
   */
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

/** Request body for `POST /notifications/announcements` (TRAINER/SUPER_ADMIN only). */
export interface CreateAnnouncementPayload {
  groupId: string;
  title?: string;
  message: string;
}

/** Response of a successful announcement broadcast — how many trainees received it. */
export interface AnnouncementResult {
  notifiedCount: number;
}
