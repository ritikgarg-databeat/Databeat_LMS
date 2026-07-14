import { Archive, BookOpen, CheckCircle2, FileEdit, GraduationCap, Layers } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';

import { useCourseStatsQuery } from '../hooks';

/**
 * Trainer/Admin dashboard summary row for the classroom module — modeled directly on
 * `GroupStatsCards` (see `src/features/groups/components/group-stats-cards.tsx`): self-detects
 * admin-vs-trainer via the route base path, fetches its own stats, and renders a `StatCard` grid
 * plus a link-out affordance. The only difference between the two contexts is which base path the
 * "view all" link uses.
 */
function ClassroomStatsCards() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const classroomBasePath = isAdminRoute ? '/admin/classroom' : '/trainer/classroom';

  const { data, isLoading, isError, refetch } = useCourseStatsQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load course statistics." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Classroom</p>
        <Link to={classroomBasePath} className="text-sm text-primary hover:underline">
          View all courses
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Courses" value={data?.totalCourses ?? 0} icon={BookOpen} isLoading={isLoading} />
        <StatCard label="Published" value={data?.publishedCourses ?? 0} icon={CheckCircle2} isLoading={isLoading} />
        <StatCard label="Draft" value={data?.draftCourses ?? 0} icon={FileEdit} isLoading={isLoading} />
        <StatCard label="Archived" value={data?.archivedCourses ?? 0} icon={Archive} isLoading={isLoading} />
        <StatCard
          label="Assigned Groups"
          value={data?.assignedGroupsCount ?? 0}
          icon={Layers}
          isLoading={isLoading}
        />
        <StatCard
          label="Active Learners"
          value={data?.activeLearners ?? 0}
          icon={GraduationCap}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export { ClassroomStatsCards };
