import { ArrowRight, BookOpen, Clock, Flame, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorScreen, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/utils/date';

import { ActivityHeatmap, AnalyticsBarChart, ChartCard, formatHours, ProgressMeter } from '../components';
import type { ChartCardTableView } from '../components';
import { useMyAnalyticsQuery } from '../hooks';
import type { CourseProgressStatus, DailyActivityPoint } from '../types';

const STATUS_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<CourseProgressStatus, 'secondary' | 'warning' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

/** Parses a `YYYY-MM-DD` (or ISO) date string as a LOCAL date — never `new Date(string)`. */
function parseDateOnly(input: string): Date {
  const [year, month, day] = input.slice(0, 10).split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Monday-first week-start key, e.g. `2026-06-29`. */
function weekStartOf(date: Date): Date {
  const mondayIndex = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - mondayIndex);
  start.setHours(0, 0, 0, 0);
  return start;
}

function weekKeyOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function totalEventsOf(point: DailyActivityPoint): number {
  return point.logins + point.lessonsCompleted + point.assessmentsSubmitted + point.aiMessages + point.qnaPosts;
}

interface WeeklyActivityDatum {
  week: string;
  total: number;
  [key: string]: unknown;
}

/** Aggregates daily activity into Monday-first weeks (sum of all event counts), last N weeks. */
function buildWeeklyActivity(dailyActivity: DailyActivityPoint[], weekCount: number): WeeklyActivityDatum[] {
  const totalsByWeek = new Map<string, { start: Date; total: number }>();

  for (const point of dailyActivity) {
    const start = weekStartOf(parseDateOnly(point.date));
    const key = weekKeyOf(start);
    const bucket = totalsByWeek.get(key);
    if (bucket) {
      bucket.total += totalEventsOf(point);
    } else {
      totalsByWeek.set(key, { start, total: totalEventsOf(point) });
    }
  }

  return [...totalsByWeek.values()]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(-weekCount)
    .map((bucket) => ({
      week: bucket.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      total: bucket.total,
    }));
}

/** Table twin for the weekly activity chart. */
function buildWeeklyActivityTableView(data: WeeklyActivityDatum[]): ChartCardTableView {
  return {
    headers: ['Week starting', 'Total activity'],
    rows: data.map((datum) => [datum.week, datum.total]),
  };
}

/** Table twin for the heatmap — the trailing 14 days, most recent first. */
function buildHeatmapTableView(dailyActivity: DailyActivityPoint[]): ChartCardTableView {
  const sorted = [...dailyActivity].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  return {
    headers: ['Date', 'Logins', 'Lessons Completed', 'Assessments Submitted', 'AI Messages', 'Q&A Posts'],
    rows: sorted.map((point) => [
      formatDate(point.date),
      point.logins,
      point.lessonsCompleted,
      point.assessmentsSubmitted,
      point.aiMessages,
      point.qnaPosts,
    ]),
  };
}

const WEEKLY_ACTIVITY_SERIES = [{ key: 'total', label: 'Activity', slot: 1 as const }];

function MyProgressPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Deep dive on learning progress: activity heatmap, weekly trend, and per-course breakdown. */
function MyProgressPage() {
  const { data, isLoading, isError, refetch } = useMyAnalyticsQuery();

  if (isLoading) {
    return <MyProgressPageSkeleton />;
  }

  if (isError || !data) {
    return <ErrorScreen message="Failed to load your progress." onRetry={() => void refetch()} />;
  }

  const { performance, streakDays, courses, dailyActivity } = data;
  const weeklyActivity = buildWeeklyActivity(dailyActivity, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Progress</h1>
        <p className="text-muted-foreground">A deep dive into your learning activity over time.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Courses Completed"
          value={`${performance.coursesCompleted}/${performance.coursesAssigned}`}
          icon={BookOpen}
        />
        <StatCard
          label="Lessons Completed"
          value={`${performance.lessonsCompleted}/${performance.totalAssignedLessons}`}
          icon={GraduationCap}
        />
        <StatCard label="Time Spent" value={formatHours(performance.timeSpentSeconds)} icon={Clock} />
        <StatCard
          label="Current Streak"
          value={streakDays > 0 ? `${streakDays} days` : 'Start today'}
          icon={Flame}
        />
      </div>

      <ChartCard
        title="Learning activity"
        description="Daily activity over the last 13 weeks"
        tableView={buildHeatmapTableView(dailyActivity)}
      >
        {dailyActivity.length === 0 ? (
          <EmptyState title="No activity recorded yet" description="Your daily activity will show up here." />
        ) : (
          <ActivityHeatmap data={dailyActivity} weeks={13} />
        )}
      </ChartCard>

      <ChartCard
        title="Weekly activity"
        description="Total activity events per week, last 12 weeks"
        tableView={buildWeeklyActivityTableView(weeklyActivity)}
      >
        {weeklyActivity.length === 0 ? (
          <EmptyState title="No activity recorded yet" description="Your weekly activity will show up here." />
        ) : (
          <AnalyticsBarChart data={weeklyActivity} xKey="week" series={WEEKLY_ACTIVITY_SERIES} />
        )}
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>My Courses</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <EmptyState
              title="No courses assigned yet"
              description="Check back once your trainer assigns you a course."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/trainee/classroom/${course.courseId}`}
                        className="flex items-center gap-1.5 hover:underline"
                      >
                        {course.title}
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <ProgressMeter value={course.completionPercentage} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[course.status]}>
                        {STATUS_LABEL[course.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatHours(course.timeSpentSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { MyProgressPage };
