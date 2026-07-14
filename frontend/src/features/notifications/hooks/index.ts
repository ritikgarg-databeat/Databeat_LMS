// React hooks (including TanStack Query hooks) for the notifications feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '../services';
import type { CreateAnnouncementPayload, NotificationListParams } from '../types';

const NOTIFICATIONS_LIST_QUERY_KEY = 'notifications-list';
const UNREAD_NOTIFICATION_COUNT_QUERY_KEY = 'notifications-unread-count';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every call to `GET /notifications` also lazily generates any newly-due
 * `ASSESSMENT_DEADLINE_APPROACHING` reminders server-side (see services/index.ts and backend
 * notifications/README.md) — so simply rendering a "recent notifications" list or a full
 * notifications page is itself part of how reminders get created, not just displayed.
 */
export function useNotificationsQuery(params: NotificationListParams) {
  return useQuery({
    queryKey: [NOTIFICATIONS_LIST_QUERY_KEY, params],
    queryFn: () => notificationsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

/**
 * Polls every 60s and refetches on window focus. This isn't ordinary "keep it fresh" polling:
 * per notifications/README.md there is no background scheduler in this project, so periodically
 * re-checking notification state is the deliberate, intended stand-in for real-time delivery
 * (Prompt 6 — "real-time delivery can be added later"). A bell badge that updates within about a
 * minute of a new notification/reminder being created (e.g. by a trainer creating a calendar
 * event, or by this app's own `useNotificationsQuery` list call generating a deadline reminder
 * elsewhere in the app) is the reasonable, intended behavior here, not something to avoid.
 */
export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: [UNREAD_NOTIFICATION_COUNT_QUERY_KEY],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                        */
/* -------------------------------------------------------------------------- */

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [UNREAD_NOTIFICATION_COUNT_QUERY_KEY] });
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export function useMarkNotificationReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}

export function useDeleteNotificationMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: invalidate,
  });
}

/**
 * TRAINER/SUPER_ADMIN-only broadcast. Doesn't touch the caller's own notification queries (the
 * recipients are the group's trainees, not the caller) — the caller surfaces `notifiedCount`
 * from the mutation result directly (see notifications-page.tsx's announcement dialog).
 */
export function useCreateAnnouncementMutation() {
  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) => notificationsApi.createAnnouncement(payload),
  });
}
