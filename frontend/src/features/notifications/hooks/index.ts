// React hooks (including TanStack Query hooks) for the notifications feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '../services';
import type { CreateAnnouncementPayload, NotificationListParams } from '../types';

const NOTIFICATIONS_LIST_QUERY_KEY = 'notifications-list';
const UNREAD_NOTIFICATION_COUNT_QUERY_KEY = 'notifications-unread-count';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Lists the user's existing notifications; reminder generation belongs to the worker. */
export function useNotificationsQuery(params: NotificationListParams, enabled = true) {
  return useQuery({
    queryKey: [NOTIFICATIONS_LIST_QUERY_KEY, params],
    queryFn: () => notificationsApi.list(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/**
 * Polls every 60s and refetches on window focus so the badge stays reasonably current without a
 * WebSocket connection. Deadline generation itself belongs to the background worker.
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
