// React hooks (including TanStack Query hooks) for the calendar feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { calendarApi } from '../services';
import type {
  CalendarEventListParams,
  CreateCalendarEventPayload,
  MyCalendarEventListParams,
  UpdateCalendarEventPayload,
} from '../types';

/**
 * For populating an "assign this event to departments/groups" picker, reuse the groups
 * feature's own lookup hooks at the point of use — `useActiveDepartmentsOptions`/`useGroupsQuery`
 * from `@/features/groups/hooks` — the same pattern classroom's `assign-groups-dialog.tsx`
 * follows for course-group assignment. Not re-exported from here to avoid a second name for the
 * same hook.
 */

const CALENDAR_EVENTS_LIST_QUERY_KEY = 'calendar-events-list';
const CALENDAR_EVENT_QUERY_KEY = 'calendar-event';
const MY_CALENDAR_EVENTS_QUERY_KEY = 'calendar-my-events';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Trainer/Admin management list — `GET /calendar/events`. */
export function useCalendarEventsQuery(params: CalendarEventListParams) {
  return useQuery({
    queryKey: [CALENDAR_EVENTS_LIST_QUERY_KEY, params],
    queryFn: () => calendarApi.listEvents(params),
    placeholderData: (previous) => previous,
  });
}

/** Trainee-facing (but open to any role) list scoped to the caller — `GET /calendar/events/mine`. */
export function useMyCalendarEventsQuery(params: MyCalendarEventListParams) {
  return useQuery({
    queryKey: [MY_CALENDAR_EVENTS_QUERY_KEY, params],
    queryFn: () => calendarApi.listMyEvents(params),
    placeholderData: (previous) => previous,
  });
}

export function useCalendarEventQuery(id: string | undefined) {
  return useQuery({
    queryKey: [CALENDAR_EVENT_QUERY_KEY, id],
    queryFn: () => calendarApi.getEvent(id as string),
    enabled: Boolean(id),
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A create/update/delete on the management surface can change which events a trainee's `mine`
 * view shows (department/group re-assignment) — every mutation below invalidates both the
 * Trainer/Admin list family AND the trainee `mine` query family.
 */
function useInvalidateCalendarEvents() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [CALENDAR_EVENTS_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [MY_CALENDAR_EVENTS_QUERY_KEY] });
  };
}

function useInvalidateCalendarEvent() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [CALENDAR_EVENT_QUERY_KEY, id] });
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export function useCreateCalendarEventMutation() {
  const invalidateEvents = useInvalidateCalendarEvents();
  return useMutation({
    mutationFn: (payload: CreateCalendarEventPayload) => calendarApi.createEvent(payload),
    onSuccess: invalidateEvents,
  });
}

export function useUpdateCalendarEventMutation() {
  const invalidateEvents = useInvalidateCalendarEvents();
  const invalidateEvent = useInvalidateCalendarEvent();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCalendarEventPayload }) =>
      calendarApi.updateEvent(id, payload),
    onSuccess: (_data, variables) => {
      invalidateEvents();
      invalidateEvent(variables.id);
    },
  });
}

export function useDeleteCalendarEventMutation() {
  const invalidateEvents = useInvalidateCalendarEvents();
  return useMutation({
    mutationFn: (id: string) => calendarApi.removeEvent(id),
    onSuccess: invalidateEvents,
  });
}
