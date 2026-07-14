// Trainer drill-down: GET /analytics/users/:id.
import { isAxiosError } from 'axios';
import { Award, CheckCircle2, Clock, Flame, GraduationCap, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRelativeTime } from '@/utils/date';

import { ActivityHeatmap, ChartCard, formatHours, formatPercent, ProgressMeter } from '../components';
import { useUserAnalyticsQuery } from '../hooks';
import type { CourseProgressStatus } from '../types';

const ACTIVITY_TABLE_DAYS = 14;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` -> `Jul 5`, without ever constructing a `Date` (avoids UTC off-by-one). */
function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  const monthLabel = MONTH_ABBR[Number(month) - 1] ?? month;
  return `${monthLabel} ${Number(day)}`;
}

const COURSE_STATUS_VARIANT: Record<CourseProgressStatus, BadgeProps['variant']> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
};

const COURSE_STATUS_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

function UserAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useUserAnalyticsQuery(id);

  const activityTableView = useMemo(() => {
    if (!data) return { headers: [], rows: [] };
    const rows = data.dailyActivity.slice(-ACTIVITY_TABLE_DAYS).map((point) => [
      formatShortDate(point.date),
      point.logins,
      point.lessonsCompleted,
      point.assessmentsSubmitted,
      point.aiMessages,
      point.qnaPosts,
    ]);
    return {
      headers: ['Date', 'Logins', 'Lessons Completed', 'Assessments Submitted', 'AI Messages', 'Q&A Posts'],
      rows,
    };
  }, [data]);

  if (!id) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 403) {
      return (
        <ErrorScreen title="Access denied" message="You can only view analytics for trainees assigned to you." />
      );
    }
    if (httpStatus === 404) {
      return <ErrorScreen title="User not found" message="This user may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load user analytics." onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { user, performance } = data;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {user.email}
          {user.departmentName ? ` · ${user.departmentName}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {user.groupNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">
            Last login: {user.lastLogin ? formatRelativeTime(user.lastLogin) : 'never'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Completion" value={formatPercent(performance.completionPercentage)} icon={CheckCircle2} />
        <StatCard
          label="Avg Score"
          value={performance.averageScore === null ? '—' : formatPercent(performance.averageScore)}
          icon={Award}
        />
        <StatCard
          label="Courses Completed"
          value={`${performance.coursesCompleted}/${performance.coursesAssigned}`}
          icon={GraduationCap}
        />
        <StatCard
          label="Lessons"
          value={`${performance.lessonsCompleted}/${performance.totalAssignedLessons}`}
          icon={ListChecks}
        />
        <StatCard label="Time Spent" value={formatHours(performance.timeSpentSeconds)} icon={Clock} />
        <StatCard label="Streak" value={`${data.streakDays}d`} icon={Flame} />
      </div>

      <ChartCard title="Activity" description="Last 13 weeks" tableView={activityTableView}>
        <ActivityHeatmap data={data.dailyActivity} />
      </ChartCard>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Courses</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.courses.map((course) => (
              <TableRow key={course.courseId}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell>
                  <ProgressMeter value={course.completionPercentage} className="w-32" />
                </TableCell>
                <TableCell>
                  <Badge variant={COURSE_STATUS_VARIANT[course.status]}>
                    {COURSE_STATUS_LABEL[course.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(course.timeSpentSeconds)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Recent Attempts</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assessment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recentAttempts.map((attempt) => (
              <TableRow key={attempt.attemptId}>
                <TableCell className="font-medium">{attempt.assessmentTitle}</TableCell>
                <TableCell>
                  <Badge variant="outline">{attempt.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {attempt.percentage === null ? '—' : formatPercent(attempt.percentage)}
                </TableCell>
                <TableCell>
                  {attempt.passed === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Badge variant={attempt.passed ? 'success' : 'destructive'}>
                      {attempt.passed ? 'Passed' : 'Failed'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {attempt.submittedAt ? formatRelativeTime(attempt.submittedAt) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Score</CardTitle>
        </CardHeader>
        <CardContent className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold tracking-tight">{performance.performanceScore}</span>
          <span className="text-xs text-muted-foreground">
            Metrics computed {formatRelativeTime(performance.computedAt)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

export { UserAnalyticsPage };
