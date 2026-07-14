// Reusable analytics panel: GET /analytics/assessments/:id.
// NOT a routed page — embed as `<AssessmentAnalyticsPanel assessmentId={assessment.id} />` inside
// an existing assessment page. Owns its own loading/error/empty states so it can be dropped in
// anywhere.
import { isAxiosError } from 'axios';
import { CheckCircle2, ListChecks, Percent, Users } from 'lucide-react';
import { useMemo } from 'react';

import { ErrorScreen, StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { AnalyticsBarChart, ChartCard, formatPercent, ProgressMeter } from '../components';
import { useAssessmentAnalyticsQuery } from '../hooks';

export interface AssessmentAnalyticsPanelProps {
  assessmentId: string;
  className?: string;
}

const CORRECT_RATE_WARNING_THRESHOLD = 50;

function AssessmentAnalyticsPanel({ assessmentId, className }: AssessmentAnalyticsPanelProps) {
  const { data, isLoading, isError, error, refetch } = useAssessmentAnalyticsQuery(assessmentId);

  const weakTopicsSorted = useMemo(() => {
    if (!data) return [];
    // Lowest correct rate first — these are the revision candidates the caption promises.
    return [...data.weakTopics].sort((a, b) => a.correctRate - b.correctRate);
  }, [data]);

  const weakTopicsTableView = useMemo(
    () => ({
      headers: ['Category', 'Answered', 'Correct', 'Correct Rate'],
      rows: weakTopicsSorted.map((topic) => [topic.category, topic.answeredCount, topic.correctCount, formatPercent(topic.correctRate)]),
    }),
    [weakTopicsSorted],
  );

  // `AnalyticsBarChart` takes `Record<string, unknown>[]`; fresh object literals (unlike the
  // named `WeakTopic` interface) satisfy that structurally, so remap rather than pass `WeakTopic[]`.
  const weakTopicsChartData = useMemo(
    () => weakTopicsSorted.map((topic) => ({ category: topic.category, correctRate: topic.correctRate })),
    [weakTopicsSorted],
  );

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 404) {
      return <ErrorScreen title="Assessment not found" message="This assessment may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load assessment analytics." onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned" value={data.assignedTrainees} icon={Users} />
        <StatCard label="Participation" value={formatPercent(data.participationRate)} icon={ListChecks} />
        <StatCard
          label="Avg Score"
          value={data.averageScore === null ? '—' : formatPercent(data.averageScore)}
          icon={Percent}
        />
        <StatCard
          label="Pass Rate"
          value={data.passRate === null ? '—' : formatPercent(data.passRate)}
          icon={CheckCircle2}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Question Difficulty</h3>
          <p className="text-sm text-muted-foreground">How trainees performed on each question.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Answered</TableHead>
              <TableHead>Correct Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.questionStats.map((question) => (
              <TableRow key={question.assessmentQuestionId}>
                <TableCell className="font-medium">{question.title}</TableCell>
                <TableCell className="text-muted-foreground">{question.type}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{question.category}</Badge>
                </TableCell>
                <TableCell>
                  {question.difficulty ? <Badge variant="outline">{question.difficulty}</Badge> : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{question.answeredCount}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <ProgressMeter value={question.correctRate} className="w-28" />
                    {question.correctRate < CORRECT_RATE_WARNING_THRESHOLD ? (
                      <p className="text-xs font-medium text-destructive">
                        {formatPercent(question.correctRate)} correct — below 50%
                      </p>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ChartCard
        title="Weak Topics"
        description="Lowest first — candidates for revision"
        tableView={weakTopicsTableView}
      >
        <AnalyticsBarChart
          data={weakTopicsChartData}
          xKey="category"
          series={[{ key: 'correctRate', label: 'Correct Rate', slot: 1 }]}
          yDomain={[0, 100]}
        />
      </ChartCard>
    </div>
  );
}

export { AssessmentAnalyticsPanel };
