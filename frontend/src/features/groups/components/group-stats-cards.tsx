import { Archive, Building2, GraduationCap, Layers, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';
import { formatDate } from '@/utils/date';

import { useGroupStatsQuery } from '../hooks';

/**
 * Reusable dashboard summary row (Prompt 4 § DASHBOARD CARDS — "Total Groups/Departments/
 * Trainees, Active/Inactive Groups, Recently Created"). Rendered on both the Admin and
 * Trainer dashboards; the only difference between them is which base path group links use.
 */
function GroupStatsCards() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const groupsBasePath = isAdminRoute ? '/admin/groups' : '/trainer/groups';

  const { data, isLoading, isError, refetch } = useGroupStatsQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load group statistics." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Groups" value={data?.totalGroups ?? 0} icon={Layers} isLoading={isLoading} />
        <StatCard label="Active Groups" value={data?.activeGroups ?? 0} icon={Users} isLoading={isLoading} />
        <StatCard
          label="Archived Groups"
          value={data?.archivedGroups ?? 0}
          icon={Archive}
          isLoading={isLoading}
        />
        <StatCard
          label="Departments"
          value={data?.totalDepartments ?? 0}
          icon={Building2}
          isLoading={isLoading}
        />
        <StatCard
          label="Trainees"
          value={data?.totalTrainees ?? 0}
          icon={GraduationCap}
          isLoading={isLoading}
        />
      </div>

      {data && data.recentGroups.length > 0 ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Recently created</p>
          <ul className="space-y-2">
            {data.recentGroups.map((group) => (
              <li key={group.id} className="flex items-center justify-between text-sm">
                <Link to={`${groupsBasePath}/${group.id}`} className="hover:underline">
                  {group.name} <span className="text-muted-foreground">({group.code})</span>
                </Link>
                <span className="text-muted-foreground">{formatDate(group.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { GroupStatsCards };
