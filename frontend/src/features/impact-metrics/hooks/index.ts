import { useQuery } from '@tanstack/react-query';

import { impactMetricsApi } from '../services';
import type { DateRangeFilters, ImpactReportParams, PilotDashboardParams } from '../types';

export function useAutoGradingLatencyQuery(filters: DateRangeFilters) {
  return useQuery({
    queryKey: ['impact-metrics-auto-grading-latency', filters],
    queryFn: () => impactMetricsApi.autoGradingLatency(filters),
  });
}

export function useAiQuizGenLatencyQuery(filters: DateRangeFilters) {
  return useQuery({
    queryKey: ['impact-metrics-ai-quiz-gen-latency', filters],
    queryFn: () => impactMetricsApi.aiQuizGenLatency(filters),
  });
}

export function useCsvImportSpeedQuery(filters: DateRangeFilters) {
  return useQuery({
    queryKey: ['impact-metrics-csv-import-speed', filters],
    queryFn: () => impactMetricsApi.csvImportSpeed(filters),
  });
}

export function usePilotDashboardQuery(params: PilotDashboardParams | null) {
  return useQuery({
    queryKey: ['impact-metrics-pilot-dashboard', params],
    queryFn: () => impactMetricsApi.pilotDashboard(params as PilotDashboardParams),
    enabled: Boolean(params?.groupId),
  });
}

export function useImpactReportQuery(params: ImpactReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ['impact-metrics-impact-report', params],
    queryFn: () => impactMetricsApi.impactReport(params),
    enabled,
  });
}
