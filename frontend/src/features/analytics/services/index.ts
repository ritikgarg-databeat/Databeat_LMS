// API calls for the analytics feature, built on the shared Axios client.
//
// Two namespaced objects, mirroring the backend module split: `dashboardApi` for the two
// role-scoped dashboard aggregates, `analyticsApi` for the drill-down analytics endpoints.
// Every method unwraps the standard `{success, message, data}` envelope.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  AssessmentAnalytics,
  CourseAnalytics,
  GroupAnalyticsDetail,
  GroupAnalyticsList,
  GroupsAnalyticsParams,
  LeaderboardData,
  LeaderboardParams,
  LiveAnalyticsOverview,
  LiveAnalyticsParams,
  TraineeDashboard,
  TrainerDashboard,
  UserAnalytics,
} from '../types';

export const dashboardApi = {
  async getTraineeDashboard(): Promise<TraineeDashboard> {
    const { data } = await apiClient.get<ApiSuccessResponse<TraineeDashboard>>('/dashboard/trainee');
    return data.data;
  },

  async getTrainerDashboard(): Promise<TrainerDashboard> {
    const { data } = await apiClient.get<ApiSuccessResponse<TrainerDashboard>>('/dashboard/trainer');
    return data.data;
  },
};

export const analyticsApi = {
  async getOverview(params: LiveAnalyticsParams): Promise<LiveAnalyticsOverview> {
    const { data } = await apiClient.get<ApiSuccessResponse<LiveAnalyticsOverview>>('/analytics/overview', {
      params,
    });
    return data.data;
  },
  async getGroups(params?: GroupsAnalyticsParams): Promise<GroupAnalyticsList> {
    const { data } = await apiClient.get<ApiSuccessResponse<GroupAnalyticsList>>('/analytics/groups', {
      params,
    });
    return data.data;
  },

  async getGroup(id: string): Promise<GroupAnalyticsDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<GroupAnalyticsDetail>>(`/analytics/groups/${id}`);
    return data.data;
  },

  async getUser(id: string): Promise<UserAnalytics> {
    const { data } = await apiClient.get<ApiSuccessResponse<UserAnalytics>>(`/analytics/users/${id}`);
    return data.data;
  },

  /** The caller's own analytics — same payload shape as `getUser`, no id needed. */
  async getMe(): Promise<UserAnalytics> {
    const { data } = await apiClient.get<ApiSuccessResponse<UserAnalytics>>('/analytics/me');
    return data.data;
  },

  async getLeaderboard(params?: LeaderboardParams): Promise<LeaderboardData> {
    const { data } = await apiClient.get<ApiSuccessResponse<LeaderboardData>>('/analytics/leaderboard', {
      params,
    });
    return data.data;
  },

  async getCourse(id: string): Promise<CourseAnalytics> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseAnalytics>>(`/analytics/courses/${id}`);
    return data.data;
  },

  async getAssessment(id: string): Promise<AssessmentAnalytics> {
    const { data } = await apiClient.get<ApiSuccessResponse<AssessmentAnalytics>>(
      `/analytics/assessments/${id}`,
    );
    return data.data;
  },
};
