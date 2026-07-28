import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { timingObservationsApi } from '../services';
import type { CreateTimingObservationPayload, TimingObservationListFilters, TimingObservationListParams } from '../types';

const TIMING_OBSERVATIONS_LIST_QUERY_KEY = 'timing-observations-list';
const TIMING_OBSERVATIONS_STATS_QUERY_KEY = 'timing-observations-stats';

export function useTimingObservationsQuery(params: TimingObservationListParams) {
  return useQuery({
    queryKey: [TIMING_OBSERVATIONS_LIST_QUERY_KEY, params],
    queryFn: () => timingObservationsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useTimingObservationStatsQuery(filters: TimingObservationListFilters) {
  return useQuery({
    queryKey: [TIMING_OBSERVATIONS_STATS_QUERY_KEY, filters],
    queryFn: () => timingObservationsApi.stats(filters),
    placeholderData: (previous) => previous,
  });
}

export function useCreateTimingObservationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimingObservationPayload) => timingObservationsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TIMING_OBSERVATIONS_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [TIMING_OBSERVATIONS_STATS_QUERY_KEY] });
    },
  });
}
