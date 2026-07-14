import { ArrowRight, CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/utils/date';

import { useMyCalendarEventsQuery } from '../hooks';
import type { CalendarEventType } from '../types';

const UPCOMING_WINDOW_DAYS = 30;
const MAX_EVENTS_SHOWN = 5;

const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  CLASS: 'Class',
  LIVE_SESSION: 'Live Session',
  ASSESSMENT: 'Assessment',
  DEADLINE: 'Deadline',
  HOLIDAY: 'Holiday',
  MEETING: 'Meeting',
  REMINDER: 'Reminder',
};

/** Trainee dashboard widget — the next few upcoming calendar events, linking into `MyCalendarPage`. */
function UpcomingEventsWidget() {
  // Computed once per mount rather than every render, so the query params (and therefore the
  // query key) stay stable instead of shifting by a few milliseconds on every re-render.
  const { from, to } = useMemo(() => {
    const start = new Date();
    const end = new Date(start.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { data, isLoading, isError, refetch } = useMyCalendarEventsQuery({ from, to });

  if (isError) {
    return <ErrorScreen message="Failed to load upcoming events." onRetry={() => void refetch()} />;
  }

  const events = (data ?? []).slice(0, MAX_EVENTS_SHOWN);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Upcoming Events</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.CALENDAR}>
            Calendar <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events in the next 30 days.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">{event.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{EVENT_TYPE_LABEL[event.type]}</Badge>
                  <span className="text-muted-foreground">{formatDate(event.startAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { UpcomingEventsWidget };
