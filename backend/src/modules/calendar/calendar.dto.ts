// Request/response DTOs (API-facing shapes) for the calendar module.
import type { CalendarEventType } from '@prisma/client';

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  type: CalendarEventType;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  location?: string;
  departmentIds?: string[];
  groupIds?: string[];
}

/**
 * `departmentIds`/`groupIds` REPLACE the full assignment set when present in the request body —
 * omitting both keys entirely leaves existing assignments untouched (see
 * calendar.service.ts#update). Distinguishing "key omitted" from "key present" relies on these
 * staying plain optional properties (checked with `!== undefined` at the service layer) rather
 * than being defaulted to `[]` anywhere upstream.
 */
export interface UpdateCalendarEventDto {
  title?: string;
  description?: string | null;
  type?: CalendarEventType;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  location?: string | null;
  departmentIds?: string[];
  groupIds?: string[];
}

export interface ListCalendarEventsQueryDto {
  from?: string;
  to?: string;
  type?: CalendarEventType;
}

export interface ListMyCalendarEventsQueryDto {
  from?: string;
  to?: string;
}
