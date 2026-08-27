// React hooks (TanStack Query) for the analytics feature.
//
// All read-only queries — analytics data is computed server-side, so there are no mutations or
// invalidation helpers here. Param-driven lists (`useGroupsAnalyticsQuery`, `useLeaderboardQuery`)
// keep the previous page rendered while a filter change refetches (`placeholderData`), so filter
// flips never flash an empty state.
import { useQuery } from '@tanstack/react-query';

import { analyticsApi, dashboardApi } from '../services';
import type { GroupsAnalyticsParams, LeaderboardParams, LiveAnalyticsParams } from '../types';

const TRAINEE_DASHBOARD_QUERY_KEY = 'dashboard-trainee';
const TRAINER_DASHBOARD_QUERY_KEY = 'dashboard-trainer';
const ANALYTICS_GROUPS_QUERY_KEY = 'analytics-groups';
const ANALYTICS_GROUP_DETAIL_QUERY_KEY = 'analytics-group-detail';
const ANALYTICS_USER_QUERY_KEY = 'analytics-user';
const ANALYTICS_ME_QUERY_KEY = 'analytics-me';
const ANALYTICS_LEADERBOARD_QUERY_KEY = 'analytics-leaderboard';
const ANALYTICS_COURSE_QUERY_KEY = 'analytics-course';
const ANALYTICS_ASSESSMENT_QUERY_KEY = 'analytics-assessment';
const ANALYTICS_OVERVIEW_QUERY_KEY = 'analytics-overview';

/* -------------------------------------------------------------------------- */
/* Dashboards                                                                  */
/* -------------------------------------------------------------------------- */

export function useTraineeDashboardQuery() {
  return useQuery({
    queryKey: [TRAINEE_DASHBOARD_QUERY_KEY],
    queryFn: () => dashboardApi.getTraineeDashboard(),
  });
}

export function useTrainerDashboardQuery() {
  return useQuery({
    queryKey: [TRAINER_DASHBOARD_QUERY_KEY],
    queryFn: () => dashboardApi.getTrainerDashboard(),
  });
}

/* -------------------------------------------------------------------------- */
/* Drill-down analytics                                                        */
/* -------------------------------------------------------------------------- */

export function useGroupsAnalyticsQuery(params?: GroupsAnalyticsParams) {
  return useQuery({
    queryKey: [ANALYTICS_GROUPS_QUERY_KEY, params],
    queryFn: () => analyticsApi.getGroups(params),
    placeholderData: (previous) => previous,
  });
}

export function useLiveAnalyticsQuery(params: LiveAnalyticsParams) {
  return useQuery({
    queryKey: [ANALYTICS_OVERVIEW_QUERY_KEY, params],
    queryFn: () => analyticsApi.getOverview(params),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });
}

export function useGroupAnalyticsQuery(id: string | undefined) {
  return useQuery({
    queryKey: [ANALYTICS_GROUP_DETAIL_QUERY_KEY, id],
    queryFn: () => analyticsApi.getGroup(id as string),
    enabled: Boolean(id),
  });
}

export function useUserAnalyticsQuery(id: string | undefined) {
  return useQuery({
    queryKey: [ANALYTICS_USER_QUERY_KEY, id],
    queryFn: () => analyticsApi.getUser(id as string),
    enabled: Boolean(id),
  });
}

export function useMyAnalyticsQuery() {
  return useQuery({
    queryKey: [ANALYTICS_ME_QUERY_KEY],
    queryFn: () => analyticsApi.getMe(),
  });
}

export function useLeaderboardQuery(params: LeaderboardParams) {
  return useQuery({
    queryKey: [ANALYTICS_LEADERBOARD_QUERY_KEY, params],
    queryFn: () => analyticsApi.getLeaderboard(params),
    placeholderData: (previous) => previous,
  });
}

export function useCourseAnalyticsQuery(id: string | undefined) {
  return useQuery({
    queryKey: [ANALYTICS_COURSE_QUERY_KEY, id],
    queryFn: () => analyticsApi.getCourse(id as string),
    enabled: Boolean(id),
  });
}

export function useAssessmentAnalyticsQuery(id: string | undefined) {
  return useQuery({
    queryKey: [ANALYTICS_ASSESSMENT_QUERY_KEY, id],
    queryFn: () => analyticsApi.getAssessment(id as string),
    enabled: Boolean(id),
  });
}
