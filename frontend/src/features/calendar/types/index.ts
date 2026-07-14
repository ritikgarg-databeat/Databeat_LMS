// TypeScript types and interfaces for the calendar feature.
//
// Mirrors the backend's CalendarEvent/CalendarEventAssignment models
// (backend/src/prisma/schema.prisma) and calendar.dto.ts/calendar.service.ts.

export type CalendarEventType =
  'CLASS' | 'LIVE_SESSION' | 'ASSESSMENT' | 'DEADLINE' | 'HOLIDAY' | 'MEETING' | 'REMINDER';

export interface CalendarEventDepartmentSummary {
  id: string;
  name: string;
}

export interface CalendarEventGroupSummary {
  id: string;
  name: string;
  code: string;
}

/** `assignments` breakdown embedded in every Trainer/Admin-facing `CalendarEvent`. */
export interface CalendarEventAssignmentSummary {
  departments: CalendarEventDepartmentSummary[];
  groups: CalendarEventGroupSummary[];
}

/**
 * Trainer/Admin management shape — `GET /calendar/events`, `GET /calendar/events/:id`,
 * `POST /calendar/events`, `PATCH /calendar/events/:id` all return this.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: CalendarEventAssignmentSummary;
}

/**
 * `GET /calendar/events/mine` list item — deliberately does NOT extend `CalendarEvent`: this
 * trainee-facing shape omits `assignments` (and the management-only scalar fields) entirely.
 */
export interface MyCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
}

export interface CalendarEventListParams {
  from?: string;
  to?: string;
  type?: CalendarEventType;
}

/** `GET /calendar/events/mine` only accepts `from`/`to` — no `type` filter (see backend ListMyCalendarEventsQueryDto). */
export type MyCalendarEventListParams = Pick<CalendarEventListParams, 'from' | 'to'>;

export interface CreateCalendarEventPayload {
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
 * omitting BOTH keys entirely leaves existing assignments untouched (see backend
 * calendar.dto.ts#UpdateCalendarEventDto). Keep these plain optional properties rather than
 * defaulting to `[]` anywhere upstream, so "key omitted" stays distinguishable from "key present
 * but empty".
 */
export interface UpdateCalendarEventPayload {
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
