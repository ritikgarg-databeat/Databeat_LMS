import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  DateRangeFilters,
  ImpactReport,
  ImpactReportParams,
  PilotDashboardParams,
  PilotDashboardReport,
  UsageMetricReport,
} from '../types';

export const impactMetricsApi = {
  async autoGradingLatency(filters: DateRangeFilters): Promise<UsageMetricReport> {
    const { data } = await apiClient.get<ApiSuccessResponse<UsageMetricReport>>('/impact-metrics/reports/auto-grading-latency', {
      params: filters,
    });
    return data.data;
  },

  async aiQuizGenLatency(filters: DateRangeFilters): Promise<UsageMetricReport> {
    const { data } = await apiClient.get<ApiSuccessResponse<UsageMetricReport>>(
      '/impact-metrics/reports/ai-quiz-generation-latency',
      { params: filters },
    );
    return data.data;
  },

  async csvImportSpeed(filters: DateRangeFilters): Promise<UsageMetricReport> {
    const { data } = await apiClient.get<ApiSuccessResponse<UsageMetricReport>>('/impact-metrics/reports/csv-import-speed', {
      params: filters,
    });
    return data.data;
  },

  async pilotDashboard(params: PilotDashboardParams): Promise<PilotDashboardReport> {
    const { data } = await apiClient.get<ApiSuccessResponse<PilotDashboardReport>>('/impact-metrics/pilot-dashboard', {
      params,
    });
    return data.data;
  },

  async impactReport(params: ImpactReportParams): Promise<ImpactReport> {
    const { data } = await apiClient.get<ApiSuccessResponse<ImpactReport>>('/impact-metrics/impact-report', { params });
    return data.data;
  },
};
