// Trainee-facing single-attempt result — `/trainee/assessments/:id/result`. `useAttemptMineQuery`
// returns one of three shapes depending on the attempt's status and the assessment's
// `showResultImmediately` toggle (see `MyAttemptResponse`'s doc comment in `types/index.ts` for the
// authoritative three-case breakdown) — this page branches on exactly those cases.
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ErrorScreen, LoadingScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error';

import { useAssessmentQuery, useAttemptMineQuery } from '../hooks';
import type { GradedAttemptQuestion, GradedAttemptResponse, MyAttemptResponse } from '../types';

/** True only for the fully-revealed shape — status GRADED *and* the score fields aren't nulled out. */
function isFullyGraded(response: MyAttemptResponse): response is GradedAttemptResponse {
  return response.attempt.status === 'GRADED' && response.attempt.percentage !== null;
}

function QuestionResultCard({ question, maxMarksLabel }: { question: GradedAttemptQuestion; maxMarksLabel?: number }) {
  const Icon = question.isCorrect === true ? CheckCircle2 : question.isCorrect === false ? XCircle : Circle;
  const iconClass =
    question.isCorrect === true
      ? 'text-success'
      : question.isCorrect === false
        ? 'text-destructive'
        : 'text-muted-foreground';

  const selectedIds = new Set(question.yourAnswer?.selectedOptionIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Icon className={cn('size-5 shrink-0', iconClass)} aria-hidden />
            Question {question.position}. {question.snapshotTitle}
          </span>
          <span className="shrink-0 text-sm font-normal text-muted-foreground">
            {question.marksAwarded ?? 0} / {maxMarksLabel ?? question.marks} marks
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {question.snapshotOptions && question.snapshotOptions.length > 0 ? (
          <ul className="space-y-1.5">
            {question.snapshotOptions.map((option) => {
              const wasSelected = selectedIds.has(option.id);
              return (
                <li
                  key={option.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2',
                    option.isCorrect && 'border-success/50 bg-success/10',
                    wasSelected && !option.isCorrect && 'border-destructive/50 bg-destructive/10',
                  )}
                >
                  {wasSelected ? <span className="text-xs font-medium">(your answer)</span> : null}
                  <span>{option.text}</span>
                  {option.isCorrect ? <CheckCircle2 className="ml-auto size-4 text-success" aria-hidden /> : null}
                </li>
              );
            })}
          </ul>
        ) : question.snapshotType === 'FILE_UPLOAD' ? (
          <p>
            <span className="font-medium">Your submission: </span>
            {question.yourAnswer?.fileOriginalFilename ?? 'No file uploaded'}
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              <span className="font-medium">Your answer: </span>
              {question.yourAnswer?.textAnswer || <span className="text-muted-foreground">No answer given</span>}
            </p>
            {question.snapshotCorrectAnswers && question.snapshotCorrectAnswers.length > 0 ? (
              <p>
                <span className="font-medium">Expected answer: </span>
                {question.snapshotCorrectAnswers.join(' / ')}
              </p>
            ) : null}
          </div>
        )}

        {question.snapshotExplanation ? (
          <p className="rounded-md bg-muted p-3 text-muted-foreground">
            <span className="font-medium text-foreground">Explanation: </span>
            {question.snapshotExplanation}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AssessmentResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: assessment } = useAssessmentQuery(id);
  const { data: response, isLoading, isError, error, refetch } = useAttemptMineQuery(id);

  const attemptStatus = response?.attempt.status;

  useEffect(() => {
    if (id && attemptStatus === 'IN_PROGRESS') {
      navigate(`${ROUTES.TRAINEE.ASSESSMENTS}/${id}/take`, { replace: true });
    }
  }, [id, attemptStatus, navigate]);

  if (!id) return null;

  if (isLoading) {
    return <LoadingScreen message="Loading your result..." fullScreen={false} />;
  }

  if (isError) {
    return <ErrorScreen message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  if (!response) return null;

  const { attempt } = response;
  const title = assessment?.title ?? 'Assessment result';

  if (attempt.status === 'IN_PROGRESS') {
    // Redirect is handled by the effect above — render nothing meanwhile.
    return <LoadingScreen message="Resuming your attempt..." fullScreen={false} />;
  }

  if (attempt.status === 'SUBMITTED' || attempt.status === 'PENDING_REVIEW') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Submitted — awaiting results.
          </CardContent>
        </Card>
      </div>
    );
  }

  // attempt.status === 'GRADED' from here on.
  if (!isFullyGraded(response)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Your submission is being reviewed. Results will be available once grading is complete.
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxMarks = assessment?.maxMarks;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div>
            <p className="text-sm text-muted-foreground">Your score</p>
            <p className="text-3xl font-semibold tracking-tight">
              {attempt.totalScore ?? 0}
              {maxMarks !== undefined ? ` / ${maxMarks}` : ''}
              <span className="ml-2 text-lg font-normal text-muted-foreground">({attempt.percentage}%)</span>
            </p>
          </div>
          <Badge variant={attempt.passed ? 'success' : 'destructive'} className="px-3 py-1.5 text-sm">
            {attempt.passed ? 'Passed' : 'Failed'}
          </Badge>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {response.questions.map((question) => (
          <QuestionResultCard key={question.id} question={question} maxMarksLabel={question.marks} />
        ))}
      </div>
    </div>
  );
}

export { AssessmentResultPage };
