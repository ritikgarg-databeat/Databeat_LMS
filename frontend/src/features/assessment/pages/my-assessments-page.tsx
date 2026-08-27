// Trainee-facing "my assessments" list — `/trainee/assessments`. One card per assessment
// assigned (via a group) to the current trainee, with the action driven by `myAttempt.status`.
import { CalendarClock, ClipboardList, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { useMyAssessmentsQuery } from '../hooks';
import type { AssessmentAttemptStatus, MyAssessmentSummary } from '../types';

/** How soon (ms) a due date counts as "approaching" and gets a warning badge. */
const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type DueUrgency = 'none' | 'approaching' | 'overdue';

function dueUrgency(dueDate: string | null): DueUrgency {
  if (!dueDate) return 'none';
  const diff = new Date(dueDate).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff <= DUE_SOON_WINDOW_MS) return 'approaching';
  return 'none';
}

const ATTEMPT_STATUS_BADGE_VARIANT: Record<AssessmentAttemptStatus, BadgeProps['variant']> = {
  IN_PROGRESS: 'secondary',
  SUBMITTED: 'default',
  PENDING_REVIEW: 'warning',
  GRADED: 'success',
};

function DueDateNote({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const urgency = dueUrgency(dueDate);

  if (urgency === 'none') {
    return (
      <span className="inline-flex items-center gap-1">
        <CalendarClock className="size-3.5" aria-hidden />
        Due {formatDate(dueDate)}
      </span>
    );
  }

  return (
    <Badge variant={urgency === 'overdue' ? 'destructive' : 'warning'} className="gap-1 font-normal">
      <CalendarClock className="size-3.5" aria-hidden />
      Due {formatDate(dueDate)}
      {urgency === 'overdue' ? ' — past due' : ' — due soon'}
    </Badge>
  );
}

function AssessmentAction({ assessment }: { assessment: MyAssessmentSummary }) {
  const takeHref = `${ROUTES.TRAINEE.ASSESSMENTS}/${assessment.id}/take`;
  const resultHref = `${ROUTES.TRAINEE.ASSESSMENTS}/${assessment.id}/result`;
  const attempt = assessment.myAttempt;

  if (!attempt) {
    return (
      <Button asChild size="sm">
        <Link to={takeHref}>Start</Link>
      </Button>
    );
  }

  switch (attempt.status) {
    case 'IN_PROGRESS':
      return (
        <Button asChild size="sm">
          <Link to={takeHref}>Continue</Link>
        </Button>
      );
    case 'SUBMITTED':
    case 'PENDING_REVIEW':
      return <Badge variant={ATTEMPT_STATUS_BADGE_VARIANT[attempt.status]}>Awaiting grading</Badge>;
    case 'GRADED':
      return (
        <div className="flex items-center gap-2">
          <Badge variant={attempt.passed ? 'success' : 'destructive'}>
            {attempt.percentage !== null ? `${attempt.percentage}%` : '—'} ·{' '}
            {attempt.passed ? 'Pass' : 'Fail'}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link to={resultHref}>View Result</Link>
          </Button>
        </div>
      );
    default:
      return null;
  }
}

function MyAssessmentsPage() {
  const { data: assessments, isLoading, isError, error, refetch } = useMyAssessmentsQuery();

  if (isLoading) {
    return <LoadingScreen message="Loading your assessments..." fullScreen={false} />;
  }

  if (isError) {
    return <ErrorScreen message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Assessments</h1>
        <p className="text-muted-foreground">Assessments assigned to you.</p>
      </div>

      {!assessments || assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments assigned yet"
          description="Check back later — your trainer will assign assessments to your group."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((assessment) => (
            <Card key={assessment.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{assessment.title}</CardTitle>
                {assessment.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{assessment.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Timer className="size-3.5" aria-hidden />
                  {assessment.durationMinutes} min · {assessment.questionCount} question
                  {assessment.questionCount === 1 ? '' : 's'} · {assessment.maxMarks} marks
                </div>
                <DueDateNote dueDate={assessment.dueDate} />
              </CardContent>
              <CardFooter className="justify-end">
                <AssessmentAction assessment={assessment} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { MyAssessmentsPage };
