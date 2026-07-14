import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';

import type { CalendarEventType } from '../types';

import { EVENT_TYPE_META } from './event-type-badge';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_MAX_VISIBLE_PER_DAY = 3;

/** Minimal shape this view needs from an event — both `CalendarEvent`/`MyCalendarEvent` (and synthetic entries) satisfy it. */
export interface CalendarMonthViewEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
}

export interface CalendarMonthViewProps {
  month: Date;
  events: CalendarMonthViewEvent[];
  /** Fired when the empty area of a day cell is clicked. Omit for a read-only calendar. */
  onDayClick?: (date: Date) => void;
  /** Fired when an event chip is clicked. Omit to render chips as static (non-interactive). */
  onEventClick?: (eventId: string) => void;
  /** Caps chips rendered per day before collapsing the rest behind "+N more". Defaults to 3. */
  maxVisiblePerDay?: number;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Builds the full grid of day cells for the given month (Sun-Sat), padded with the leading/
 * trailing days of the adjacent months needed to complete whole weeks.
 */
function buildMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const days: Date[] = [];
  for (const cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

/**
 * A plain CSS-grid month calendar — no calendar-grid library (react-big-calendar, FullCalendar,
 * ...) is installed, so this 7-column grid + day cells + colored event chips IS the entire
 * implementation. Multi-day events intentionally only render on their `startAt` day; day-spanning
 * bars are out of scope here.
 */
function CalendarMonthView({
  month,
  events,
  onDayClick,
  onEventClick,
  maxVisiblePerDay = DEFAULT_MAX_VISIBLE_PER_DAY,
}: CalendarMonthViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const days = useMemo(() => buildMonthGrid(month), [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarMonthViewEvent[]>();
    for (const event of events) {
      const key = dateKey(new Date(event.startAt));
      const existing = map.get(key);
      if (existing) {
        existing.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    }
    return map;
  }, [events]);

  const today = new Date();

  const toggleExpanded = (key: string) => {
    setExpandedDays((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, today);
          const isExpanded = expandedDays.has(key);
          const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, maxVisiblePerDay);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={key}
              className={cn(
                'relative min-h-28 border-b border-r p-1.5',
                isCurrentMonth ? 'bg-background' : 'bg-muted/30',
              )}
            >
              {/* Full-cell click target for "create an event on this day", painted behind the
                  content below (see the z-index pair) so chips stay independently clickable. */}
              {onDayClick ? (
                <button
                  type="button"
                  className="absolute inset-0 z-0"
                  aria-label={`Create event on ${day.toLocaleDateString()}`}
                  onClick={() => onDayClick(day)}
                />
              ) : null}

              <div className="relative z-10 flex flex-col gap-1">
                <span
                  className={cn(
                    'pointer-events-none inline-flex size-6 items-center justify-center rounded-full text-xs',
                    isCurrentMonth ? 'text-foreground' : 'text-muted-foreground',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {day.getDate()}
                </span>

                {visibleEvents.map((event) => {
                  const label = event.allDay ? event.title : `${formatTime(event.startAt)} ${event.title}`;
                  const chipClassName = cn(
                    'truncate rounded border px-1.5 py-0.5 text-left text-xs font-medium',
                    EVENT_TYPE_META[event.type].colorClassName,
                  );
                  return onEventClick ? (
                    <button
                      key={event.id}
                      type="button"
                      className={cn(chipClassName, 'hover:opacity-80')}
                      title={label}
                      onClick={() => onEventClick(event.id)}
                    >
                      {label}
                    </button>
                  ) : (
                    <div key={event.id} className={chipClassName} title={label}>
                      {label}
                    </div>
                  );
                })}

                {dayEvents.length > maxVisiblePerDay ? (
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => toggleExpanded(key)}
                  >
                    {isExpanded ? 'Show less' : `+${hiddenCount} more`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { CalendarMonthView };
