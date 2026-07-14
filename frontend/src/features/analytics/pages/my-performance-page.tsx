import { Activity, CheckCircle2, ClipboardList, Target } from 'lucide-react';

import { EmptyState, ErrorScreen, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TraineeRecommendationsCard } from '@/features/dashboard/components/trainee-recommendations-card';
import { formatDate } from '@/utils/date';

import { AnalyticsLineChart, ChartCard, formatPercent } from '../components';
import { useMyAnalyticsQuery, useTraineeDashboardQuery } from '../hooks';
import type { RecentAttempt } from '../types';

const SCORE_SERIES = [{ key: 'percentage', label: 'Score', slot: 1 as const }];

interface ScorePoint {
  date: string;
  percentage: number;
  [key: string]: unknown;
}

/** Chronological (submittedAt asc), null-percentage attempts skipped — for the trend chart. */
function buildScoreTrend(attempts: RecentAttempt[]): ScorePoint[] {
  return attempts
    .filter((attempt) => attempt.percentage !== null && attempt.submittedAt !== null)
    .sort((a, b) => new Date(a.submittedAt as string).getTime() - new Date(b.submittedAt as string).getTime())
    .map((attempt) => ({
      date: formatDate(attempt.submittedAt as string),
      percentage: attempt.percentage as number,
    }));
}

function MyPerformancePageSkeleton() {
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
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** Performance/assessment deep dive: composite score, score trend, recent attempts, recommendations. */
function MyPerformancePage() {
  const { data, isLoading, isError, refetch } = useMyAnalyticsQuery();
  // `/analytics/me` has no recommendations field — only `/dashboard/trainee` does. TanStack Query
  // dedupes/caches this against the dashboard page's own call, so this is not an extra round trip
  // when both have been visited in the same session.
  const dashboardQuery = useTraineeDashboardQuery();

  if (isLoading) {
    return <MyPerformancePageSkeleton />;
  }

  if (isError || !data) {
    return <ErrorScreen message="Failed to load your performance." onRetry={() => void refetch()} />;
  }

  const { performance, recentAttempts } = data;
  const scoreTrend = buildScoreTrend(recentAttempts);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Performance</h1>
        <p className="text-muted-foreground">Your composite score, trend, and recent assessment results.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Performance Score" value={performance.performanceScore.toFixed(1)} icon={Target} />
        <StatCard
          label="Average Score"
          value={performance.averageScore === null ? '—' : formatPercent(performance.averageScore)}
          icon={ClipboardList}
        />
        <StatCard
          label="Assessments Passed"
          value={`${performance.assessmentsPassed}/${performance.assessmentsTaken}`}
          icon={CheckCircle2}
        />
        <StatCard label="Activity (7d)" value={performance.activityEvents7d} icon={Activity} />
      </div>

      <ChartCard
        title="Scores over time"
        description="Percentage scored on each graded assessment, in submission order"
        tableView={{
          headers: ['Date', 'Score'],
          rows: scoreTrend.map((point) => [point.date, `${point.percentage}%`]),
        }}
      >
        {scoreTrend.length < 2 ? (
          <EmptyState
            title="Take more assessments to see your trend"
            description="Your score history will chart here once you have at least two graded attempts."
          />
        ) : (
          <AnalyticsLineChart data={scoreTrend} xKey="date" series={SCORE_SERIES} yDomain={[0, 100]} />
        )}
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttempts.length === 0 ? (
            <EmptyState title="No attempts yet" description="Assessment attempts will show up here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttempts.map((attempt) => (
                  <TableRow key={attempt.attemptId}>
                    <TableCell className="max-w-48 truncate font-medium">{attempt.assessmentTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{attempt.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {attempt.percentage === null ? '—' : formatPercent(attempt.percentage)}
                    </TableCell>
                    <TableCell>
                      {attempt.passed === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={attempt.passed ? 'success' : 'destructive'}>
                          {attempt.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {attempt.submittedAt ? formatDate(attempt.submittedAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dashboardQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : dashboardQuery.data ? (
        <TraineeRecommendationsCard recommendations={dashboardQuery.data.recommendations} />
      ) : null}
    </div>
  );
}

export { MyPerformancePage };
