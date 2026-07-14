import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime } from '@/utils/date';

import { CalendarMonthView } from '../components/calendar-month-view';
import { CreateEventDialog } from '../components/create-event-dialog';
import { EditEventDialog } from '../components/edit-event-dialog';
import { EventTypeBadge } from '../components/event-type-badge';
import { useCalendarEventsQuery } from '../hooks';
import type { CalendarEvent } from '../types';

/**
 * Plain helper (rather than inlining `Date.now()` in the component body) so the impure "current
 * time" read doesn't happen directly inside render/`useMemo` — mirrors
 * `trainee-assessment-summary-card.tsx#isDueDateUpcoming`'s same pattern.
 */
function isUpcoming(startAt: string): boolean {
  return new Date(startAt).getTime() >= Date.now();
}

/** Trainer/Admin calendar management — mounted at `{basePath}/calendar` for both `/admin` and `/trainer`. */
function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const monthStart = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    [currentMonth],
  );
  const monthEnd = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999),
    [currentMonth],
  );

  const {
    data: events,
    isLoading,
    isError,
    refetch,
  } = useCalendarEventsQuery({ from: monthStart.toISOString(), to: monthEnd.toISOString() });

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth),
    [currentMonth],
  );

  /** Compact agenda beside the grid — the next few events, scoped to whatever month is currently in view. */
  const upcomingEvents = useMemo(() => {
    return [...(events ?? [])]
      .filter((event) => isUpcoming(event.startAt))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 8);
  }, [events]);

  const goToPreviousMonth = () =>
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleEventClick = (eventId: string) => {
    const event = (events ?? []).find((candidate) => candidate.id === eventId);
    if (event) setEditingEvent(event);
  };

  if (isError) {
    return <ErrorScreen message="Failed to load the calendar." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Schedule classes, sessions, deadlines, and other events.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Event
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={goToPreviousMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={goToNextMonth}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
        <h2 className="ml-2 text-lg font-medium">{monthLabel}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : (
            <CalendarMonthView
              month={currentMonth}
              events={events ?? []}
              onDayClick={() => setCreateOpen(true)}
              onEventClick={handleEventClick}
            />
          )}
        </div>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" description="Events you create will show up here." />
            ) : (
              <ul className="space-y-3">
                {upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="w-full rounded-md p-2 text-left hover:bg-accent"
                      onClick={() => setEditingEvent(event)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{event.title}</span>
                        <EventTypeBadge type={event.type} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.allDay ? formatDate(event.startAt) : formatDateTime(event.startAt)}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditEventDialog event={editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)} />
    </div>
  );
}

export { CalendarPage };
