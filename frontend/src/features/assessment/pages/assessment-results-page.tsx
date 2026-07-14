// Trainer/Admin results overview for one assessment — `{basePath}/assessments/:id/results`.
// Paginated attempts table with a quick "Needs grading" filter (PENDING_REVIEW only). Each row
// links through to `AttemptGradingPage` for the full answer-by-answer grading view.
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/utils/date';

import { useAssessmentQuery, useAttemptsQuery } from '../hooks';
import type { AssessmentAttemptStatus } from '../types';

const ATTEMPTS_PAGE_SIZE = 20;

type ResultsFilter = 'ALL' | 'PENDING_REVIEW';

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

function AssessmentResultsPage() {
  const { id } = useParams<{ id: string }>();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const [filter, setFilter] = useState<ResultsFilter>('ALL');
  const [page, setPage] = useState(1);

  const { data: assessment } = useAssessmentQuery(id);
  const {
    data: attempts,
    isLoading,
    isError,
    error,
    refetch,
  } = useAttemptsQuery(id, {
    page,
    pageSize: ATTEMPTS_PAGE_SIZE,
    status: filter === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : undefined,
  });

  if (!id) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 404) {
      return <ErrorScreen title="Assessment not found" message="This assessment may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load results." onRetry={() => void refetch()} />;
  }

  const maxMarks = assessment?.maxMarks;
  const totalPages = attempts ? Math.max(1, Math.ceil(attempts.meta.total / attempts.meta.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {assessment ? assessment.title : 'Assessment'} — Results
          </h1>
          {assessment ? (
            <p className="text-muted-foreground">Passing score: {assessment.passingPercentage}%</p>
          ) : null}
        </div>
        <Button asChild variant="outline">
          <Link to={`${basePath}/assessments/${id}/analytics`}>View Analytics</Link>
        </Button>
      </div>

      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as ResultsFilter);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="ALL">All attempts</TabsTrigger>
          <TabsTrigger value="PENDING_REVIEW">Needs grading</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !attempts ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !attempts.items.length ? (
        <EmptyState
          title={filter === 'PENDING_REVIEW' ? 'Nothing needs grading' : 'No one has attempted this assessment yet'}
          description={
            filter === 'PENDING_REVIEW'
              ? 'Every submitted attempt has already been fully graded.'
              : 'Results will appear here once a trainee starts this assessment.'
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.items.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-medium">
                    <Link to={`${basePath}/assessments/${id}/results/${attempt.id}`} className="hover:underline">
                      {attempt.user.firstName} {attempt.user.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{attempt.user.email}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[attempt.status]}>{STATUS_LABEL[attempt.status]}</Badge>
                  </TableCell>
                  <TableCell>{attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}</TableCell>
                  <TableCell>
                    {attempt.totalScore !== null
                      ? `${attempt.totalScore}${maxMarks !== undefined ? ` / ${maxMarks}` : ''}`
                      : attempt.percentage !== null
                        ? `${attempt.percentage}%`
                        : '—'}
                  </TableCell>
                  <TableCell>
                    {attempt.status === 'GRADED' && attempt.passed !== null ? (
                      <Badge variant={attempt.passed ? 'success' : 'destructive'}>
                        {attempt.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground">
                  Page {attempts.meta.page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={page * ATTEMPTS_PAGE_SIZE >= attempts.meta.total}
                  className={
                    page * ATTEMPTS_PAGE_SIZE >= attempts.meta.total
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
}

export { AssessmentResultsPage };
