// Notification center — mounted at `{basePath}/notifications` for all three roles (same
// component reused for Admin/Trainer/Trainee, self-detecting the base path the same way
// `notification-bell.tsx` and the classroom/groups dashboard widgets do).
import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLES } from '@/constants/roles';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';

import { CreateAnnouncementDialog } from '../components/create-announcement-dialog';
import {
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '../hooks';
import type { Notification, NotificationType } from '../types';

const NOTIFICATIONS_PAGE_SIZE = 20;

type ReadFilter = 'ALL' | 'UNREAD';

/** `ASSESSMENT_ASSIGNED`/`ASSESSMENT_DEADLINE_APPROACHING` share the clipboard/alert family; the
 * two calendar types share the calendar family; the two Q&A types share the message family —
 * distinct icons within each pair/family for scannability. */
const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
  ASSESSMENT_ASSIGNED: ClipboardList,
  ASSESSMENT_DEADLINE_APPROACHING: AlarmClock,
  CALENDAR_EVENT_CREATED: CalendarPlus,
  CALENDAR_EVENT_UPDATED: CalendarClock,
  QNA_ANSWER_POSTED: MessageSquare,
  QNA_ANSWER_VERIFIED: CheckCircle2,
  COURSE_ASSIGNED: BookOpen,
  TRAINER_ANNOUNCEMENT: Megaphone,
};

/**
 * Resolves where clicking a notification should navigate. Mirrors
 * `notification-bell.tsx#resolveNotificationLink` exactly (not imported — that function isn't
 * exported from the bell component) so both surfaces send a user to the same destination for the
 * same notification. `relatedEntityType` values come from the backend's various `notify()`
 * call sites (assessments/calendar/qna/courses services) — see notifications/types#Notification.
 */
function resolveNotificationLink(basePath: string, notification: Notification): string | null {
  switch (notification.relatedEntityType) {
    case 'assessment':
      return notification.relatedEntityId
        ? `${basePath}/assessments/${notification.relatedEntityId}`
        : `${basePath}/assessments`;
    case 'calendar_event':
      return `${basePath}/calendar`;
    case 'qna_question':
      return notification.relatedEntityId
        ? `${basePath}/qna/${notification.relatedEntityId}`
        : `${basePath}/qna`;
    case 'course':
      return notification.relatedEntityId
        ? `${basePath}/classroom/${notification.relatedEntityId}`
        : `${basePath}/classroom`;
    default:
      // e.g. `group` (TRAINER_ANNOUNCEMENT) — no trainee-facing group detail page to link to.
      return null;
  }
}

function NotificationsPage() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const basePath = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/trainee')
      ? '/trainee'
      : '/trainer';
  const { user } = useAuth();
  const canSendAnnouncements = user?.role === ROLES.TRAINER || user?.role === ROLES.SUPER_ADMIN;

  const [filter, setFilter] = useState<ReadFilter>('ALL');
  const [page, setPage] = useState(1);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useNotificationsQuery({
    page,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
    unreadOnly: filter === 'UNREAD' ? true : undefined,
  });
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();
  const deleteNotification = useDeleteNotificationMutation();

  if (isError) {
    return <ErrorScreen message="Failed to load notifications." onRetry={() => void refetch()} />;
  }

  const notifications = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  const handleSelect = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(basePath, notification);
    if (link) navigate(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Assessments, calendar updates, Q&amp;A activity, course assignments, and trainer announcements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canSendAnnouncements ? (
            <Button size="sm" onClick={() => setIsAnnouncementOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New Announcement
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {canSendAnnouncements && user ? (
        <CreateAnnouncementDialog
          open={isAnnouncementOpen}
          onOpenChange={setIsAnnouncementOpen}
          role={user.role}
        />
      ) : null}

      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as ReadFilter);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="UNREAD">Unread only</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'UNREAD' ? "You're all caught up" : 'No notifications yet'}
          description={
            filter === 'UNREAD'
              ? 'You have no unread notifications.'
              : "You'll see assessment assignments, deadlines, and calendar updates here."
          }
        />
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_TYPE_ICON[notification.type];
              return (
                <li
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-2 transition-colors hover:bg-accent/50',
                    !notification.isRead && 'bg-accent/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(notification)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {!notification.isRead ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        ) : null}
                        <p
                          className={cn(
                            'truncate text-sm',
                            !notification.isRead ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2 mt-1.5 shrink-0"
                    aria-label="Delete notification"
                    disabled={deleteNotification.isPending}
                    onClick={() => deleteNotification.mutate(notification.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground">
                  Page {data?.meta.page ?? page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={!data || page * NOTIFICATIONS_PAGE_SIZE >= data.meta.total}
                  className={
                    !data || page * NOTIFICATIONS_PAGE_SIZE >= data.meta.total
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
}

export { NotificationsPage };
