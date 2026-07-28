// Trainer/Super-Admin tool for logging one real, self-timed comparison of writing a lesson quiz
// by hand vs. reviewing the AI-generated one — the human-timed half of Measurable Early Impact
// that usage logs alone can't produce. Mirrors the RHF + zodResolver wiring used across this
// codebase (see qna/pages/ask-question-page.tsx for the closest precedent) and the
// paginated-table layout established by audit-log-page.tsx this same session.
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { coursesApi } from '@/features/classroom/services';
import { formatDateTime } from '@/utils/date';
import { formatSeconds } from '@/utils/duration';
import { getErrorMessage } from '@/utils/error';

import { useCreateTimingObservationMutation, useTimingObservationStatsQuery, useTimingObservationsQuery } from '../hooks';

const PAGE_SIZE = 20;
/** "Effectively all" page size for the course dropdown — same convention as qna's ask-question form. */
const OPTIONS_PAGE_SIZE = 100;

// Numeric fields are kept as raw strings (matching the native <input type="number"> value) and
// converted at submit time — avoids a zod `preprocess`/`coerce` mismatch between the resolver's
// input/output types under react-hook-form's `useForm<T>` generic (see create-assessment-dialog.tsx).
const observationSchema = z.object({
  courseId: z.string().min(1, 'Select a course.'),
  lessonId: z.string().min(1, 'Select a lesson.'),
  manualMinutes: z
    .string()
    .min(1, 'Enter a duration.')
    .refine((value) => Number(value) > 0, 'Enter a duration greater than 0.'),
  aiAssistedMinutes: z
    .string()
    .min(1, 'Enter a duration.')
    .refine((value) => Number(value) > 0, 'Enter a duration greater than 0.'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or fewer.').optional(),
});

type ObservationFormValues = z.infer<typeof observationSchema>;

function StatBlock({ label, summary, unit }: { label: string; summary: { mean: number | null; min: number | null; max: number | null }; unit: 'seconds' }) {
  return (
    <div className="space-y-1 rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {summary.mean === null ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <>
          <p className="text-lg font-semibold tabular-nums">
            {unit === 'seconds' ? formatSeconds(summary.mean) : summary.mean} avg
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            range {formatSeconds(summary.min ?? 0)}–{formatSeconds(summary.max ?? 0)}
          </p>
        </>
      )}
    </div>
  );
}

function TimingObservationsPage() {
  const [page, setPage] = useState(1);

  const coursesQuery = useQuery({
    queryKey: ['timing-observations-course-options'],
    queryFn: () => coursesApi.list({ page: 1, pageSize: OPTIONS_PAGE_SIZE }),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ObservationFormValues>({
    resolver: zodResolver(observationSchema),
    defaultValues: { courseId: '', lessonId: '', manualMinutes: '', aiAssistedMinutes: '', notes: '' },
  });

  const courseId = useWatch({ control, name: 'courseId' });
  const courseDetailQuery = useQuery({
    queryKey: ['timing-observations-course-detail', courseId],
    queryFn: () => coursesApi.getById(courseId),
    enabled: Boolean(courseId),
  });
  const lessonOptions = (courseDetailQuery.data?.modules ?? []).flatMap((courseModule) =>
    courseModule.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title })),
  );

  const createObservation = useCreateTimingObservationMutation();

  const listQuery = useTimingObservationsQuery({ page, pageSize: PAGE_SIZE });
  const statsQuery = useTimingObservationStatsQuery({});

  const onSubmit = async (values: ObservationFormValues) => {
    try {
      await createObservation.mutateAsync({
        courseId: values.courseId,
        lessonId: values.lessonId,
        manualDurationSeconds: Math.round(Number(values.manualMinutes) * 60),
        aiAssistedDurationSeconds: Math.round(Number(values.aiAssistedMinutes) * 60),
        notes: values.notes || undefined,
      });
      toast.success('Timing observation logged.');
      reset({ courseId: '', lessonId: '', manualMinutes: '', aiAssistedMinutes: '', notes: '' });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Timing Observations</h1>
        <p className="text-muted-foreground">
          Log a real, self-timed comparison of writing a lesson quiz by hand vs. reviewing the AI-generated one — the
          human-timed evidence behind Measurable Early Impact.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log a new observation</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="courseId">Course</Label>
                <Controller
                  name="courseId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue('lessonId', '');
                      }}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="courseId">
                        <SelectValue placeholder="Select a course..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(coursesQuery.data?.items ?? []).map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.courseId ? <p className="text-sm text-destructive">{errors.courseId.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lessonId">Lesson</Label>
                <Controller
                  name="lessonId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting || !courseId}>
                      <SelectTrigger id="lessonId">
                        <SelectValue placeholder={courseId ? 'Select a lesson...' : 'Select a course first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {lessonOptions.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.lessonId ? <p className="text-sm text-destructive">{errors.lessonId.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manualMinutes">Manual quiz-writing time (minutes)</Label>
                <Input id="manualMinutes" type="number" step="0.1" min="0" disabled={isSubmitting} {...register('manualMinutes')} />
                {errors.manualMinutes ? <p className="text-sm text-destructive">{errors.manualMinutes.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="aiAssistedMinutes">AI-assisted review time (minutes)</Label>
                <Input
                  id="aiAssistedMinutes"
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isSubmitting}
                  {...register('aiAssistedMinutes')}
                />
                {errors.aiAssistedMinutes ? (
                  <p className="text-sm text-destructive">{errors.aiAssistedMinutes.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" rows={2} disabled={isSubmitting} {...register('notes')} />
              {errors.notes ? <p className="text-sm text-destructive">{errors.notes.message}</p> : null}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging...' : 'Log observation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live stats</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : statsQuery.data ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                n = {statsQuery.data.n} observation{statsQuery.data.n === 1 ? '' : 's'} across{' '}
                {statsQuery.data.distinctTrainers} trainer{statsQuery.data.distinctTrainers === 1 ? '' : 's'},{' '}
                {statsQuery.data.distinctLessons} lesson{statsQuery.data.distinctLessons === 1 ? '' : 's'}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatBlock label="Manual" summary={statsQuery.data.manual} unit="seconds" />
                <StatBlock label="AI-assisted" summary={statsQuery.data.aiAssisted} unit="seconds" />
                <StatBlock label="Saved" summary={statsQuery.data.saved} unit="seconds" />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {listQuery.isError ? (
        <ErrorScreen message="Failed to load timing observations." onRetry={() => void listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !listQuery.data?.items.length ? (
        <EmptyState title="No timing observations logged yet" description="Log the first one above." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainer</TableHead>
                <TableHead>Course / Lesson</TableHead>
                <TableHead>Manual</TableHead>
                <TableHead>AI-assisted</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.data.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {entry.trainer.firstName} {entry.trainer.lastName}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{entry.lessonTitle}</div>
                    <div className="text-xs text-muted-foreground">{entry.courseTitle}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatSeconds(entry.manualDurationSeconds)}</TableCell>
                  <TableCell className="tabular-nums">{formatSeconds(entry.aiAssistedDurationSeconds)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatSeconds(entry.savedSeconds)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
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
                  Page {listQuery.data.meta.page} of {Math.max(1, Math.ceil(listQuery.data.meta.total / listQuery.data.meta.pageSize))}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={page * PAGE_SIZE >= listQuery.data.meta.total}
                  className={page * PAGE_SIZE >= listQuery.data.meta.total ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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

export { TimingObservationsPage };
