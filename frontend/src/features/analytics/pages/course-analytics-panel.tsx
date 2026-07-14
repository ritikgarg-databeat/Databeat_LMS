// Reusable analytics panel: GET /analytics/courses/:id.
// NOT a routed page — embed as `<CourseAnalyticsPanel courseId={course.id} />` inside an existing
// course page. Owns its own loading/error/empty states so it can be dropped in anywhere.
import { isAxiosError } from 'axios';
import { CheckCircle2, Clock, PlayCircle, TrendingUp, Users } from 'lucide-react';

import { ErrorScreen, StatCard } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { formatHours, formatPercent, ProgressMeter } from '../components';
import { useCourseAnalyticsQuery } from '../hooks';

export interface CourseAnalyticsPanelProps {
  courseId: string;
  className?: string;
}

const DROP_OFF_WARNING_THRESHOLD = 25;

/**
 * Course drill-down panel. The lesson funnel is rendered as an ordered table (title, completion
 * meter, drop-off %) rather than `AnalyticsBarChart`: the funnel reads naturally lesson-by-lesson
 * (many rows, long titles), and the bar-chart primitive only supports vertical columns keyed by a
 * short categorical x value — there's no horizontal-layout prop to check for. A table is already
 * its own accessibility twin, so no extra `tableView` is needed here.
 */
function CourseAnalyticsPanel({ courseId, className }: CourseAnalyticsPanelProps) {
  const { data, isLoading, isError, error, refetch } = useCourseAnalyticsQuery(courseId);

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 404) {
      return <ErrorScreen title="Course not found" message="This course may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load course analytics." onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Assigned" value={data.assignedTrainees} icon={Users} />
        <StatCard label="Started" value={data.startedCount} icon={PlayCircle} />
        <StatCard label="Completed" value={data.completedCount} icon={CheckCircle2} />
        <StatCard label="Completion Rate" value={formatPercent(data.completionRate)} icon={TrendingUp} />
        <StatCard label="Avg Time" value={formatHours(data.averageTimeSpentSeconds)} icon={Clock} />
        <StatCard
          label="Avg Score"
          value={data.averageScore === null ? '—' : formatPercent(data.averageScore)}
          icon={TrendingUp}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Avg Score is a population proxy — the average across every trainee assigned to this course, not
        per-lesson.
      </p>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Lesson Funnel</h3>
          <p className="text-sm text-muted-foreground">Completion and drop-off by lesson, in course order.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Drop-off</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lessonFunnel.map((step) => (
              <TableRow key={step.lessonId}>
                <TableCell className="font-medium">{step.title}</TableCell>
                <TableCell className="text-muted-foreground">{step.moduleTitle}</TableCell>
                <TableCell>
                  <ProgressMeter value={step.completionRate} className="w-32" />
                </TableCell>
                <TableCell className="text-right tabular-nums">{step.completedCount}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    step.dropOffRate > DROP_OFF_WARNING_THRESHOLD && 'font-medium text-warning',
                  )}
                >
                  {formatPercent(step.dropOffRate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { CourseAnalyticsPanel };
