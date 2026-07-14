// Internal domain types for the calendar module.
import type { CalendarEventType } from '@prisma/client';

export interface CalendarEventListFilters {
  from?: string;
  to?: string;
  type?: CalendarEventType;
}
