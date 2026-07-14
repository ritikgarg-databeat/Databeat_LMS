// Self-contained notification bell + dropdown for the app header.
import { useReducedMotion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';

import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from '../hooks';
import type { Notification } from '../types';

/** Only the 5 most recent notifications are shown in the dropdown preview. */
const RECENT_NOTIFICATIONS_PARAMS = { page: 1, pageSize: 5 };

/** Caps the badge label at "9+" so a double-digit count never distorts the icon button. */
function formatBadgeCount(count: number): string {
  return count > 9 ? '9+' : String(count);
}

/**
 * Resolves where clicking a notification should navigate, based on its `relatedEntityType` and
 * the caller's role-scoped base path. `ROUTES` has no per-item constant for a single
 * assessment/calendar-event, so this builds the path directly (mirrors how the backend describes
 * these as lightweight, non-FK deep-link hints — see notifications/types#Notification).
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
      return notification.relatedEntityId ? `${basePath}/qna/${notification.relatedEntityId}` : `${basePath}/qna`;
    case 'course':
      return notification.relatedEntityId
        ? `${basePath}/classroom/${notification.relatedEntityId}`
        : `${basePath}/classroom`;
    default:
      // e.g. `group` (TRAINER_ANNOUNCEMENT) — no trainee-facing group detail page to link to.
      return null;
  }
}

/**
 * Drop-in replacement for the placeholder bell button in `components/layout/header.tsx`
 * (`<Button variant="ghost" size="icon" aria-label="View notifications"><Bell /></Button>`) —
 * same trigger markup, plus an unread-count badge and a dropdown listing recent notifications.
 * Fully self-contained: no props, fetches its own data, and self-detects the current
 * Admin/Trainer/Trainee area via `useLocation().pathname`, the same pattern classroom's
 * components use (see `classroom-stats-cards.tsx`).
 */
function NotificationBell() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const basePath = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/trainee')
      ? '/trainee'
      : '/trainer';

  const { data: unreadCount } = useUnreadNotificationCountQuery();
  const { data: page, isLoading } = useNotificationsQuery(RECENT_NOTIFICATIONS_PARAMS);
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();
  const shouldReduceMotion = useReducedMotion();

  const notifications = page?.items ?? [];
  const count = unreadCount ?? 0;

  // Briefly pulses the badge only when the unread count rises DURING this session (e.g. the
  // 60s poll in useUnreadNotificationCountQuery picks up a genuinely new notification) — never
  // on first load, since `baselineRef` only starts comparing once a count has already been seen.
  // There's no backend "just arrived" timestamp to key off, so an in-session increase is the
  // closest honest proxy; the pulse self-clears rather than running forever, since an
  // ever-pulsing badge stops meaning "new" and just becomes visual noise.
  const baselineRef = useRef<number | null>(null);
  const [justArrived, setJustArrived] = useState(false);

  useEffect(() => {
    if (unreadCount === undefined) return;
    const previous = baselineRef.current;
    baselineRef.current = unreadCount;
    if (previous !== null && unreadCount > previous) {
      setJustArrived(true);
      const timeout = setTimeout(() => setJustArrived(false), 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [unreadCount]);

  const handleSelect = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = resolveNotificationLink(basePath, notification);
    if (link) navigate(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `View notifications, ${count} unread` : 'View notifications'}
        >
          <Bell className="size-4" />
          {count > 0 ? (
            <Badge
              variant="destructive"
              aria-hidden
              className={cn(
                'absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full border-0 px-1 py-0 text-[10px] font-semibold leading-none shadow-none',
                justArrived && !shouldReduceMotion && 'animate-glow-pulse',
              )}
            >
              {formatBadgeCount(count)}
            </Badge>
          ) : null}
          <span className="sr-only" role="status" aria-live="polite">
            {count > 0 ? `${count} unread notification${count === 1 ? '' : 's'}` : 'No unread notifications'}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            disabled={count === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Mark all as read
          </button>
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">You&apos;re all caught up — no notifications yet.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-0.5 whitespace-normal py-2',
                    !notification.isRead && 'bg-accent/50',
                  )}
                  onClick={() => handleSelect(notification)}
                >
                  <div className="flex w-full items-center gap-1.5">
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
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm text-primary"
          onClick={() => navigate(`${basePath}/notifications`)}
        >
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NotificationBell };
