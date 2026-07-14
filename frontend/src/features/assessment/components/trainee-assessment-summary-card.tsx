import { AlarmClock, ArrowRight, CheckCircle2, ClipboardList, Hourglass, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/utils/date';

import { useMyAssessmentsQuery } from '../hooks';
import type { MyAssessmentSummary } from '../types';

/** An assessment the trainee hasn't finished submitting yet — either untouched or IN_PROGRESS. */
function isNotYetSubmitted(item: MyAssessmentSummary): boolean {
  return item.myAttempt === null || item.myAttempt.status === 'IN_PROGRESS';
}

/**
 * True once `dueDate` (ISO) hasn't passed yet. A plain helper (rather than inlining `Date.now()`
 * in the component body) so the impure "current time" read doesn't happen directly inside render
 * — mirrors `my-assessments-page.tsx#dueUrgency`'s same pattern.
 */
function isDueDateUpcoming(dueDate: string): boolean {
  return new Date(dueDate).getTime() >= Date.now();
}

/** Trainee dashboard widget — assignment/attempt-status breakdown, nearest due date, recent scores. */
function TraineeAssessmentSummaryCard() {
  const { data, isLoading, isError, refetch } = useMyAssessmentsQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load your assessments." onRetry={() => void refetch()} />;
  }

  const items = data ?? [];

  const assigned = items.length;
  const notStarted = items.filter((item) => item.myAttempt === null).length;
  const inProgress = items.filter((item) => item.myAttempt?.status === 'IN_PROGRESS').length;
  const awaitingGrading = items.filter(
    (item) => item.myAttempt?.status === 'SUBMITTED' || item.myAttempt?.status === 'PENDING_REVIEW',
  ).length;
  const graded = items.filter((item) => item.myAttempt?.status === 'GRADED').length;

  const nextDue = items
    .filter((item) => item.dueDate !== null && isNotYetSubmitted(item) && isDueDateUpcoming(item.dueDate))
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())[0];

  const recentGraded = items
    .filter((item) => item.myAttempt?.status === 'GRADED')
    .sort((a, b) => {
      const aTime = a.myAttempt?.submittedAt ? new Date(a.myAttempt.submittedAt).getTime() : 0;
      const bTime = b.myAttempt?.submittedAt ? new Date(b.myAttempt.submittedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>My Assessments</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.ASSESSMENTS}>
            View All <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assessments assigned yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ClipboardList className="size-3.5" aria-hidden /> Assigned
                </p>
                <p className="text-xl font-semibold tracking-tight">{assigned}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hourglass className="size-3.5" aria-hidden /> Not Started
                </p>
                <p className="text-xl font-semibold tracking-tight">{notStarted}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PlayCircle className="size-3.5" aria-hidden /> In Progress
                </p>
                <p className="text-xl font-semibold tracking-tight">{inProgress}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlarmClock className="size-3.5" aria-hidden /> Awaiting Grading
                </p>
                <p className="text-xl font-semibold tracking-tight">{awaitingGrading}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Graded
                </p>
                <p className="text-xl font-semibold tracking-tight">{graded}</p>
              </div>
            </div>

            {nextDue ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <AlarmClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  Next due: <span className="font-medium">{nextDue.title}</span> —{' '}
                  {formatDate(nextDue.dueDate as string)}
                </span>
              </div>
            ) : null}

            {recentGraded.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Recent results</p>
                <ul className="space-y-1.5">
                  {recentGraded.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{item.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-muted-foreground">
                          {item.myAttempt?.percentage !== null && item.myAttempt?.percentage !== undefined
                            ? `${item.myAttempt.percentage}%`
                            : '—'}
                        </span>
                        <Badge variant={item.myAttempt?.passed ? 'success' : 'destructive'}>
                          {item.myAttempt?.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { TraineeAssessmentSummaryCard };
