// API calls for the calendar feature, built on the shared Axios client.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  CalendarEvent,
  CalendarEventListParams,
  CreateCalendarEventPayload,
  MyCalendarEvent,
  MyCalendarEventListParams,
  UpdateCalendarEventPayload,
} from '../types';

/**
 * `listEvents`/`listMyEvents` return a plain ARRAY (no `{items,meta}` pagination envelope) per
 * backend/src/modules/calendar/calendar.controller.ts — every other endpoint here follows the
 * usual `ApiSuccessResponse<T>` wrapper convention used across the rest of this codebase.
 */
export const calendarApi = {
  async listEvents(params: CalendarEventListParams): Promise<CalendarEvent[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<CalendarEvent[]>>('/calendar/events', { params });
    return data.data;
  },

  async createEvent(payload: CreateCalendarEventPayload): Promise<CalendarEvent> {
    const { data } = await apiClient.post<ApiSuccessResponse<CalendarEvent>>('/calendar/events', payload);
    return data.data;
  },

  async getEvent(id: string): Promise<CalendarEvent> {
    const { data } = await apiClient.get<ApiSuccessResponse<CalendarEvent>>(`/calendar/events/${id}`);
    return data.data;
  },

  async updateEvent(id: string, payload: UpdateCalendarEventPayload): Promise<CalendarEvent> {
    const { data } = await apiClient.patch<ApiSuccessResponse<CalendarEvent>>(
      `/calendar/events/${id}`,
      payload,
    );
    return data.data;
  },

  async removeEvent(id: string): Promise<void> {
    await apiClient.delete(`/calendar/events/${id}`);
  },

  async listMyEvents(params: MyCalendarEventListParams): Promise<MyCalendarEvent[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<MyCalendarEvent[]>>('/calendar/events/mine', {
      params,
    });
    return data.data;
  },
};
