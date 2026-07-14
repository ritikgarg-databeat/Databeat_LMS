// Trainer drill-down: GET /analytics/groups/:id.
import { isAxiosError } from 'axios';
import { Activity, ArrowLeft, ArrowUpDown, Award, CheckCircle2, Clock, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';

import { AnalyticsLineChart, ChartCard, formatHours, formatPercent, ProgressMeter } from '../components';
import { useGroupAnalyticsQuery } from '../hooks';
import type { GroupMemberAnalytics } from '../types';

const TIMELINE_CHART_DAYS = 30;
const TIMELINE_TABLE_DAYS = 14;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` -> `Jul 5`, without ever constructing a `Date` (avoids UTC off-by-one). */
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  const monthLabel = MONTH_ABBR[Number(month) - 1] ?? month;
  return `${monthLabel} ${Number(day)}`;
}

type SortKey = 'completionPercentage' | 'averageScore' | 'lessonsCompleted' | 'assessmentsTaken' | 'performanceScore';

interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHead({ label, sortKey, sort, onSort, className }: SortableHeadProps) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        <ArrowUpDown className={cn('size-3', active ? 'opacity-100' : 'opacity-40')} aria-hidden />
      </button>
    </TableHead>
  );
}

function sortMembers(members: GroupMemberAnalytics[], sort: SortState): GroupMemberAnalytics[] {
  const sorted = [...members];
  sorted.sort((a, b) => {
    const aValue = a[sort.key] ?? -1;
    const bValue = b[sort.key] ?? -1;
    return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
  });
  return sorted;
}

function GroupAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const groupsBasePath = isAdminRoute ? '/admin/groups' : '/trainer/groups';
  const { data, isLoading, isError, error, refetch } = useGroupAnalyticsQuery(id);
  const [sort, setSort] = useState<SortState>({ key: 'performanceScore', direction: 'desc' });

  const handleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  };

  const timelineData = useMemo(() => {
    if (!data) return [];
    return data.activityTimeline.slice(-TIMELINE_CHART_DAYS).map((point) => ({
      ...point,
      label: formatShortDate(point.date),
    }));
  }, [data]);

  const timelineTableView = useMemo(() => {
    if (!data) return { headers: [], rows: [] };
    const rows = data.activityTimeline.slice(-TIMELINE_TABLE_DAYS).map((point) => [
      formatShortDate(point.date),
      point.lessonsCompleted,
      point.assessmentsSubmitted,
      point.logins,
    ]);
    return { headers: ['Date', 'Lessons Completed', 'Assessments Submitted', 'Logins'], rows };
  }, [data]);

  const sortedMembers = useMemo(() => (data ? sortMembers(data.members, sort) : []), [data, sort]);

  if (!id) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 403) {
      return (
        <ErrorScreen
          title="Access denied"
          message="You can only view analytics for groups assigned to you."
        />
      );
    }
    if (httpStatus === 404) {
      return <ErrorScreen title="Group not found" message="This group may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load group analytics." onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const { group, summary } = data;
  const groupDetailPath = `${groupsBasePath}/${group.groupId}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={groupsBasePath}>Groups</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={groupDetailPath}>{group.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Analytics</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link to={groupDetailPath} aria-label="Back to group">
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            </div>
            <p className="pl-10 text-sm text-muted-foreground">
              {group.code}
              {group.departmentName ? ` · ${group.departmentName}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Trainees" value={summary.traineeCount} icon={Users} />
        <StatCard label="Avg Completion" value={formatPercent(summary.completionPercentage)} icon={CheckCircle2} />
        <StatCard
          label="Avg Score"
          value={summary.averageScore === null ? '—' : formatPercent(summary.averageScore)}
          icon={Award}
        />
        <StatCard label="Active (7d)" value={summary.activeUsers7d} icon={Activity} />
        <StatCard label="Total Time" value={formatHours(summary.totalTimeSpentSeconds)} icon={Clock} />
      </div>

      <ChartCard
        title="Activity Timeline"
        description="Last 30 days"
        tableView={timelineTableView}
      >
        <AnalyticsLineChart
          data={timelineData}
          xKey="label"
          series={[
            { key: 'lessonsCompleted', label: 'Lessons Completed', slot: 1 },
            { key: 'assessmentsSubmitted', label: 'Assessments Submitted', slot: 2 },
            { key: 'logins', label: 'Logins', slot: 3 },
          ]}
        />
      </ChartCard>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <SortableHead label="Completion" sortKey="completionPercentage" sort={sort} onSort={handleSort} />
              <SortableHead label="Avg Score" sortKey="averageScore" sort={sort} onSort={handleSort} />
              <SortableHead label="Lessons" sortKey="lessonsCompleted" sort={sort} onSort={handleSort} />
              <SortableHead label="Assessments" sortKey="assessmentsTaken" sort={sort} onSort={handleSort} />
              <TableHead>Last Activity</TableHead>
              <SortableHead
                label="Performance"
                sortKey="performanceScore"
                sort={sort}
                onSort={handleSort}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((member) => (
              <TableRow key={member.userId}>
                <TableCell className="font-medium">
                  <Link
                    to={`${isAdminRoute ? '/admin' : '/trainer'}/users/${member.userId}/analytics`}
                    className="hover:underline"
                  >
                    {member.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  <ProgressMeter value={member.completionPercentage} className="w-32" />
                </TableCell>
                <TableCell className="tabular-nums">
                  {member.averageScore === null ? '—' : formatPercent(member.averageScore)}
                </TableCell>
                <TableCell className="tabular-nums">{member.lessonsCompleted}</TableCell>
                <TableCell className="tabular-nums">{member.assessmentsTaken}</TableCell>
                <TableCell className="text-muted-foreground">
                  {member.lastActivityAt ? formatRelativeTime(member.lastActivityAt) : '—'}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{member.performanceScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { GroupAnalyticsPage };
