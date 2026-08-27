import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileEdit } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';
import { cn } from '@/lib/utils';

import { useAssessmentStatsQuery } from '../hooks';

/**
 * Trainer/Admin dashboard summary row for the assessment module — modeled directly on
 * `GroupStatsCards`/`ClassroomStatsCards` (see `src/features/groups/components/group-stats-cards.tsx`):
 * self-detects admin-vs-trainer via the route base path, fetches its own stats, and renders a
 * `StatCard` grid plus a link-out affordance.
 */
function TrainerAssessmentStatsCards() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const assessmentsBasePath = isAdminRoute ? '/admin/assessments' : '/trainer/assessments';

  const { data, isLoading, isError, refetch } = useAssessmentStatsQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load assessment statistics." onRetry={() => void refetch()} />;
  }

  const pendingGrading = data?.pendingGradingCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Assessments</p>
        <Link to={assessmentsBasePath} className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Assessments"
          value={data?.totalAssessments ?? 0}
          icon={ClipboardList}
          isLoading={isLoading}
        />
        <StatCard
          label="Published"
          value={data?.publishedAssessments ?? 0}
          icon={CheckCircle2}
          isLoading={isLoading}
        />
        <StatCard label="Draft" value={data?.draftAssessments ?? 0} icon={FileEdit} isLoading={isLoading} />
        {/* Pending grading is an actionable item for the trainer — accent it once there's work to do. */}
        <StatCard
          label="Pending Grading"
          value={pendingGrading}
          icon={AlertTriangle}
          isLoading={isLoading}
          className={cn(pendingGrading > 0 && 'border-warning/60 bg-warning/10')}
        />
        <StatCard
          label="Upcoming"
          value={data?.upcomingCount ?? 0}
          icon={CalendarClock}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export { TrainerAssessmentStatsCards };
