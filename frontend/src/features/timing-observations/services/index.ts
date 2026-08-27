import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  CreateTimingObservationPayload,
  TimingObservation,
  TimingObservationListFilters,
  TimingObservationListParams,
  TimingObservationStats,
} from '../types';

export const timingObservationsApi = {
  async create(payload: CreateTimingObservationPayload): Promise<TimingObservation> {
    const { data } = await apiClient.post<ApiSuccessResponse<TimingObservation>>(
      '/timing-observations',
      payload,
    );
    return data.data;
  },

  async list(params: TimingObservationListParams): Promise<PaginatedData<TimingObservation>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<TimingObservation>>>(
      '/timing-observations',
      {
        params,
      },
    );
    return data.data;
  },

  async stats(filters: TimingObservationListFilters): Promise<TimingObservationStats> {
    const { data } = await apiClient.get<ApiSuccessResponse<TimingObservationStats>>(
      '/timing-observations/stats',
      {
        params: filters,
      },
    );
    return data.data;
  },
};
