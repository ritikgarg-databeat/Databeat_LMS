import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyAssessmentsQuery } from '@/features/assessment/hooks';
import { formatDate, formatDateTime } from '@/utils/date';

import { CalendarMonthView } from '../components/calendar-month-view';
import { EventTypeBadge } from '../components/event-type-badge';
import { useMyCalendarEventsQuery } from '../hooks';
import type { CalendarEventType } from '../types';

/**
 * Plain helper (rather than inlining `Date.now()` in the component body) so the impure "current
 * time" read doesn't happen directly inside render/`useMemo` — mirrors
 * `trainee-assessment-summary-card.tsx#isDueDateUpcoming`'s same pattern.
 */
function isUpcoming(startAt: string): boolean {
  return new Date(startAt).getTime() >= Date.now();
}

/** A merged, read-only calendar row — either a real `MyCalendarEvent` or a synthetic assessment deadline. */
interface AgendaEntry {
  id: string;
  title: string;
  type: CalendarEventType;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  description: string | null;
  location: string | null;
}

/**
 * Trainee read-only calendar — mounted at `/trainee/calendar`. Merges two independent sources on
 * the frontend: the real calendar module's `GET /calendar/events/mine`, and each of the trainee's
 * assigned assessments' `dueDate` (from `@/features/assessment/hooks`), synthesized here as
 * `DEADLINE`-flavored entries. The backend calendar module deliberately knows nothing about
 * assessments, so this merge intentionally lives in the page, not in a shared hook.
 */
function MyCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewingEntry, setViewingEntry] = useState<AgendaEntry | null>(null);

  const monthStart = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    [currentMonth],
  );
  const monthEnd = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999),
    [currentMonth],
  );

  const {
    data: myEvents,
    isLoading: isLoadingEvents,
    isError: isEventsError,
    refetch: refetchEvents,
  } = useMyCalendarEventsQuery({ from: monthStart.toISOString(), to: monthEnd.toISOString() });
  const { data: myAssessments, isLoading: isLoadingAssessments } = useMyAssessmentsQuery();

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth),
    [currentMonth],
  );

  const mergedEntries = useMemo<AgendaEntry[]>(() => {
    const realEvents: AgendaEntry[] = (myEvents ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      description: event.description,
      location: event.location,
    }));

    const monthStartTime = monthStart.getTime();
    const monthEndTime = monthEnd.getTime();

    const deadlineEntries: AgendaEntry[] = (myAssessments ?? [])
      .map((assessment): AgendaEntry | null => {
        if (!assessment.dueDate) return null;
        const dueTime = new Date(assessment.dueDate).getTime();
        if (dueTime < monthStartTime || dueTime > monthEndTime) return null;
        return {
          id: `assessment-due-${assessment.id}`,
          title: `Due: ${assessment.title}`,
          type: 'DEADLINE',
          startAt: assessment.dueDate,
          endAt: null,
          allDay: true,
          description: 'Assessment deadline.',
          location: null,
        };
      })
      .filter((entry): entry is AgendaEntry => entry !== null);

    return [...realEvents, ...deadlineEntries];
  }, [myEvents, myAssessments, monthStart, monthEnd]);

  const upcomingEntries = useMemo(() => {
    return [...mergedEntries]
      .filter((entry) => isUpcoming(entry.startAt))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 8);
  }, [mergedEntries]);

  const goToPreviousMonth = () =>
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleEventClick = (entryId: string) => {
    const entry = mergedEntries.find((candidate) => candidate.id === entryId);
    if (entry) setViewingEntry(entry);
  };

  if (isEventsError) {
    return <ErrorScreen message="Failed to load your calendar." onRetry={() => void refetchEvents()} />;
  }

  const isLoading = isLoadingEvents || isLoadingAssessments;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Calendar</h1>
        <p className="text-muted-foreground">Your classes, sessions, and assessment deadlines.</p>
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
            <CalendarMonthView month={currentMonth} events={mergedEntries} onEventClick={handleEventClick} />
          )}
        </div>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEntries.length === 0 ? (
              <EmptyState
                title="Nothing upcoming"
                description="Your classes, sessions, and deadlines will show up here."
              />
            ) : (
              <ul className="space-y-3">
                {upcomingEntries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="w-full rounded-md p-2 text-left hover:bg-accent"
                      onClick={() => setViewingEntry(entry)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{entry.title}</span>
                        <EventTypeBadge type={entry.type} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.allDay ? formatDate(entry.startAt) : formatDateTime(entry.startAt)}
                        {entry.location ? ` · ${entry.location}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={viewingEntry !== null} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingEntry?.title}</DialogTitle>
            <DialogDescription>
              {viewingEntry
                ? viewingEntry.allDay
                  ? formatDate(viewingEntry.startAt)
                  : formatDateTime(viewingEntry.startAt)
                : null}
            </DialogDescription>
          </DialogHeader>
          {viewingEntry ? (
            <div className="space-y-2 text-sm">
              <EventTypeBadge type={viewingEntry.type} />
              {viewingEntry.description ? (
                <p className="text-muted-foreground">{viewingEntry.description}</p>
              ) : null}
              {viewingEntry.location ? (
                <p className="text-muted-foreground">Location: {viewingEntry.location}</p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { MyCalendarPage };
