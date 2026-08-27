import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { CalendarEventType } from '../types';

/**
 * Per-type label + color, the single source of truth both `EventTypeBadge` (list/detail/agenda
 * contexts) and `CalendarMonthView` (month-grid chips) draw from, so the two stay visually
 * consistent. Colors are plain Tailwind palette utilities layered on top of the base `<Badge>`
 * via `cn`/`tailwind-merge` (which safely drops the base variant's conflicting bg/text/border
 * classes) — `badgeVariants` only ships ~6 variants, short of the 7 distinct colors needed here.
 * See `src/components/ui/badge.tsx`. Each hue carries an explicit `dark:` triplet (light-mode
 * pastel chips have no automatic dark-theme equivalent the way semantic tokens do) so these read
 * correctly against the darkened card/popover surfaces instead of floating as bright pastel chips.
 * MEETING uses the neutral `muted`/`border` tokens instead of a raw gray — same "distinct 7th
 * color" role, but theme-aware for free.
 */
export interface EventTypeMeta {
  label: string;
  /** Light background + dark text + matching border — works for both the `<Badge>` and month-view chips. */
  colorClassName: string;
}

export const EVENT_TYPE_META: Record<CalendarEventType, EventTypeMeta> = {
  CLASS: {
    label: 'Class',
    colorClassName:
      'bg-blue-100 text-blue-800 border-blue-200 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300',
  },
  LIVE_SESSION: {
    label: 'Live Session',
    colorClassName:
      'bg-purple-100 text-purple-800 border-purple-200 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300',
  },
  ASSESSMENT: {
    label: 'Assessment',
    colorClassName:
      'bg-orange-100 text-orange-800 border-orange-200 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-300',
  },
  DEADLINE: {
    label: 'Deadline',
    colorClassName:
      'bg-red-100 text-red-800 border-red-200 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300',
  },
  HOLIDAY: {
    label: 'Holiday',
    colorClassName:
      'bg-green-100 text-green-800 border-green-200 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300',
  },
  MEETING: { label: 'Meeting', colorClassName: 'border-border bg-muted text-muted-foreground' },
  REMINDER: {
    label: 'Reminder',
    colorClassName:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:border-yellow-800/60 dark:bg-yellow-950/40 dark:text-yellow-300',
  },
};

/** Every `CalendarEventType` value — powers the type `<select>` in the create/edit event dialogs. */
export const EVENT_TYPE_VALUES = Object.keys(EVENT_TYPE_META) as CalendarEventType[];

export interface EventTypeBadgeProps {
  type: CalendarEventType;
  className?: string;
  variant?: BadgeProps['variant'];
}

/** Small presentational atom — colors a `CalendarEventType` using the shared per-type palette. */
function EventTypeBadge({ type, className, variant = 'outline' }: EventTypeBadgeProps) {
  const meta = EVENT_TYPE_META[type];
  return (
    <Badge variant={variant} className={cn(meta.colorClassName, className)}>
      {meta.label}
    </Badge>
  );
}

export { EventTypeBadge };
