// Trainer/Admin per-attempt grading view — `{basePath}/assessments/:id/results/:attemptId`.
// Shows the trainee's full attempt WITH the answer key (staff-only — a trainee never sees this
// shape) and renders `GradeAnswerForm` inline for every manual-review answer still awaiting a
// mark. Auto-graded answers (MCQ-family, FILL_IN_THE_BLANK, SQL_QUERY) are shown read-only since
// their `marksAwarded` is already set by the time an attempt reaches this page.
import { isAxiosError } from 'axios';
import { Check, ChevronLeft, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/date';

import { GradeAnswerForm } from '../components/grade-answer-form';
import { QuestionTypeBadge } from '../components/question-type-badge';
import { useAssessmentQuery, useAttemptDetailQuery } from '../hooks';
import type { AssessmentAttemptStatus, AttemptAnswerDetail, QuestionOption, QuestionType } from '../types';

/**
 * Question types a trainer grades by hand (see `GradeAnswerForm`). Every other `QuestionType` is
 * scored automatically at submit time (option matching / exact-text matching against
 * `snapshotCorrectAnswers`), so its `marksAwarded` is already non-null by the time this page loads.
 */
const MANUAL_REVIEW_TYPES: QuestionType[] = ['SHORT_ANSWER', 'LONG_ANSWER', 'CODE_SNIPPET', 'FILE_UPLOAD'];

function isManualReviewType(type: QuestionType): boolean {
  return MANUAL_REVIEW_TYPES.includes(type);
}

const STATUS_BADGE_VARIANT: Record<AssessmentAttemptStatus, BadgeProps['variant']> = {
  IN_PROGRESS: 'secondary',
  SUBMITTED: 'default',
  PENDING_REVIEW: 'warning',
  GRADED: 'success',
};

const STATUS_LABEL: Record<AssessmentAttemptStatus, string> = {
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  PENDING_REVIEW: 'Needs grading',
  GRADED: 'Graded',
};

function AttemptGradingPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const { data: assessment } = useAssessmentQuery(id);
  const { data: attempt, isLoading, isError, error, refetch } = useAttemptDetailQuery(id, attemptId);

  if (!id || !attemptId) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 404) {
      return <ErrorScreen title="Attempt not found" message="This attempt may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load this attempt." onRetry={() => void refetch()} />;
  }

  if (isLoading || !attempt) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Recomputed from the current query data on every render (never cached in local state) — once
  // `useGradeAnswerMutation`'s own cache invalidation refreshes this query, this count naturally
  // ticks down to zero (and the backend flips `attempt.status` to GRADED) without any manual wiring.
  const pendingCount = attempt.answers.filter(
    (answer) => isManualReviewType(answer.question.snapshotType) && answer.marksAwarded === null,
  ).length;

  const sortedAnswers = [...attempt.answers].sort((a, b) => a.question.order - b.question.order);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to={`${basePath}/assessments/${id}/results`}>
          <ChevronLeft /> Back to results
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {attempt.user.firstName} {attempt.user.lastName}
        </h1>
        <p className="text-muted-foreground">
          {attempt.user.email}
          {assessment ? ` · ${assessment.title}` : ''}
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <Badge variant={STATUS_BADGE_VARIANT[attempt.status]}>{STATUS_LABEL[attempt.status]}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Submitted</p>
            <p className="text-sm">{attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Score</p>
            {attempt.status === 'GRADED' ? (
              <p className="text-sm">
                {attempt.totalScore ?? 0}
                {assessment ? ` / ${assessment.maxMarks}` : ''} ({attempt.percentage ?? 0}%)
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pending — {pendingCount} question{pendingCount === 1 ? '' : 's'} awaiting grading
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Result</p>
            {attempt.status === 'GRADED' && attempt.passed !== null ? (
              <Badge variant={attempt.passed ? 'success' : 'destructive'}>
                {attempt.passed ? 'Pass' : 'Fail'}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      {!sortedAnswers.length ? (
        <EmptyState title="No answers submitted" description="This attempt has no recorded answers." />
      ) : (
        <div className="space-y-4">
          {sortedAnswers.map((answer) => (
            <AnswerCard key={answer.id} assessmentId={id} attemptId={attemptId} answer={answer} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AnswerCardProps {
  assessmentId: string;
  attemptId: string;
  answer: AttemptAnswerDetail;
}

/** One question's card: prompt + trainee's answer, plus either a read-only mark or `GradeAnswerForm`. */
function AnswerCard({ assessmentId, attemptId, answer }: AnswerCardProps) {
  const { question } = answer;
  const manual = isManualReviewType(question.snapshotType);
  const isGraded = answer.marksAwarded !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Q{question.order + 1}. {question.snapshotTitle}
        </CardTitle>
        <QuestionTypeBadge type={question.snapshotType} />
      </CardHeader>
      <CardContent className="space-y-4">
        <AnswerBody answer={answer} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
          {manual && !isGraded ? (
            <GradeAnswerForm
              assessmentId={assessmentId}
              attemptId={attemptId}
              answerId={answer.id}
              maxMarks={question.marks}
            />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {answer.marksAwarded !== null ? answer.marksAwarded : '—'} / {question.marks}
              </span>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {manual ? 'Graded' : 'Auto-graded'}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders the trainee's submitted answer, shaped according to the question's `snapshotType`. */
function AnswerBody({ answer }: { answer: AttemptAnswerDetail }) {
  const { question } = answer;

  switch (question.snapshotType) {
    case 'SINGLE_CORRECT_MCQ':
    case 'MULTIPLE_CORRECT':
    case 'TRUE_FALSE':
      return (
        <McqAnswerOptions
          options={question.snapshotOptions ?? []}
          selectedOptionIds={answer.selectedOptionIds}
        />
      );

    case 'FILL_IN_THE_BLANK':
    case 'SQL_QUERY':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Trainee&apos;s answer</p>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {answer.textAnswer || '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Accepted answer(s)</p>
            <p className="text-sm text-muted-foreground">
              {question.snapshotCorrectAnswers?.length ? question.snapshotCorrectAnswers.join(', ') : '—'}
            </p>
          </div>
        </div>
      );

    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Trainee&apos;s answer</p>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {answer.textAnswer || '—'}
          </p>
        </div>
      );

    case 'CODE_SNIPPET':
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Trainee&apos;s answer</p>
          <Textarea value={answer.textAnswer ?? ''} readOnly rows={8} className="font-mono text-sm" />
        </div>
      );

    case 'FILE_UPLOAD':
      // NOTE: there is currently no dedicated download endpoint for assessment-answer file
      // submissions (unlike the classroom module's lesson resources), so this deliberately shows
      // the filename as plain text rather than a broken/guessed download link. Tracked as a gap
      // for a future prompt.
      return (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Submitted file</p>
          <p className="text-sm">
            {answer.fileOriginalFilename
              ? `Submitted file: ${answer.fileOriginalFilename}`
              : 'No file submitted.'}
          </p>
        </div>
      );

    default:
      return null;
  }
}

/**
 * MCQ-family answer review — lists every option and marks it up relative to both what the
 * trainee picked (`selectedOptionIds`) and the answer key (`option.isCorrect`, visible here since
 * this page is staff-only): green check = correct + selected, red x = incorrect + selected, plain
 * check = correct but missed.
 */
function McqAnswerOptions({
  options,
  selectedOptionIds,
}: {
  options: QuestionOption[];
  selectedOptionIds: string[] | null;
}) {
  const selected = new Set(selectedOptionIds ?? []);
  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  if (!sortedOptions.length) {
    return <p className="text-sm text-muted-foreground">No options recorded for this question.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {sortedOptions.map((option) => {
        const isSelected = selected.has(option.id);
        const isCorrect = option.isCorrect;

        return (
          <li
            key={option.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
              isCorrect && isSelected && 'border-success/40 bg-success/10',
              !isCorrect && isSelected && 'border-destructive/40 bg-destructive/10',
              isCorrect && !isSelected && 'border-dashed',
            )}
          >
            {isCorrect && isSelected ? (
              <Check className="size-4 shrink-0 text-success" aria-hidden />
            ) : !isCorrect && isSelected ? (
              <X className="size-4 shrink-0 text-destructive" aria-hidden />
            ) : isCorrect ? (
              <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
            <span className="flex-1">{option.text}</span>
            {isCorrect && !isSelected ? (
              <span className="text-xs text-muted-foreground">Correct — not selected</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export { AttemptGradingPage };
