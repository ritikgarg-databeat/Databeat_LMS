import { ErrorScreen } from '@/components/shared';
import { ROUTES } from '@/constants/routes';
import { AiUsageOverviewCard } from '@/features/ai/components';
import { useTrainerDashboardQuery } from '@/features/analytics/hooks';
import { TrainerAssessmentStatsCards } from '@/features/assessment/components/trainer-assessment-stats-cards';
import { ClassroomStatsCards } from '@/features/classroom/components/classroom-stats-cards';
import { GroupStatsCards } from '@/features/groups/components';
import { useAuth } from '@/hooks/use-auth';

import { AdminQuickActions } from '../components/admin-quick-actions';
import { DeferredDashboardSection } from '../components/deferred-dashboard-section';
import { TrainerGroupAnalyticsTable } from '../components/trainer-group-analytics-table';
import { TrainerInsightsCard } from '../components/trainer-insights-card';
import { TrainerLeaderboardCard } from '../components/trainer-leaderboard-card';
import { TrainerOverviewCards } from '../components/trainer-overview-cards';
import { TrainerPendingGradingAlert } from '../components/trainer-pending-grading-alert';
import { TrainerReportsTeaserCard } from '../components/trainer-reports-teaser-card';

const ADMIN_GROUP_PREVIEW_LIMIT = 8;

/** Organization-wide dashboard using one cached staff aggregate plus deferred secondary queries. */
function AdminDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useTrainerDashboardQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.fullName ?? 'Admin'}</h1>
        <p className="text-muted-foreground">
          Organization-wide learning health, priorities, and platform operations.
        </p>
      </div>

      {isError ? (
        <ErrorScreen message="Failed to load the organization dashboard." onRetry={() => void refetch()} />
      ) : (
        <>
          <TrainerOverviewCards overview={data?.overview} isLoading={isLoading} />

          {data && data.pendingGradingCount > 0 ? (
            <TrainerPendingGradingAlert
              count={data.pendingGradingCount}
              assessmentsPath={ROUTES.ADMIN.ASSESSMENTS}
            />
          ) : null}

          <AdminQuickActions pendingGradingCount={data?.pendingGradingCount ?? 0} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TrainerGroupAnalyticsTable
                groups={data?.groups.slice(0, ADMIN_GROUP_PREVIEW_LIMIT)}
                isLoading={isLoading}
                basePath={ROUTES.ADMIN.ROOT}
              />
            </div>
            <TrainerLeaderboardCard
              entries={data?.leaderboard.items}
              isLoading={isLoading}
              basePath={ROUTES.ADMIN.ROOT}
            />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <TrainerInsightsCard insights={data?.insights} isLoading={isLoading} />
            <TrainerReportsTeaserCard reportsPath={ROUTES.ADMIN.REPORTS} />
          </div>
        </>
      )}

      <DeferredDashboardSection placeholderClassName="h-40">
        <AiUsageOverviewCard />
      </DeferredDashboardSection>

      <section className="space-y-4" aria-labelledby="platform-operations-title">
        <div>
          <h2 id="platform-operations-title" className="text-lg font-semibold tracking-tight">
            Platform Operations
          </h2>
          <p className="text-sm text-muted-foreground">
            Detailed inventory loads as you reach this section to keep the dashboard responsive.
          </p>
        </div>
        <DeferredDashboardSection placeholderClassName="h-56">
          <GroupStatsCards />
        </DeferredDashboardSection>
        <DeferredDashboardSection placeholderClassName="h-40">
          <ClassroomStatsCards />
        </DeferredDashboardSection>
        <DeferredDashboardSection placeholderClassName="h-40">
          <TrainerAssessmentStatsCards />
        </DeferredDashboardSection>
      </section>
    </div>
  );
}

export { AdminDashboardPage };
