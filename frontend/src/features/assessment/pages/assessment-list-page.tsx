// Mirrors classroom/pages/course-list-page.tsx's filterable/sortable/paginated list + row
// actions pattern almost exactly — see that file for the precedent this was built against.
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { AssessmentStatusBadge } from '../components/assessment-status-badge';
import { CreateAssessmentDialog } from '../components/create-assessment-dialog';
import { DuplicateAssessmentDialog } from '../components/duplicate-assessment-dialog';
import { EditAssessmentDialog } from '../components/edit-assessment-dialog';
import { useAssessmentsQuery, useDeleteAssessmentMutation, useUpdateAssessmentStatusMutation } from '../hooks';
import type { AssessmentSortField, AssessmentStatus, AssessmentSummary, SortOrder } from '../types';

const ASSESSMENTS_PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: '' | AssessmentStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

interface AssessmentSortOption {
  value: string;
  label: string;
  sortBy: AssessmentSortField;
  sortOrder: SortOrder;
}

/** Combines `AssessmentSortField` + `SortOrder` into a single dropdown, rather than two selects. */
const DEFAULT_SORT_OPTION: AssessmentSortOption = {
  value: 'createdAt-desc',
  label: 'Newest first',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
const SORT_OPTIONS: AssessmentSortOption[] = [
  DEFAULT_SORT_OPTION,
  { value: 'createdAt-asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'title-asc', label: 'Title (A-Z)', sortBy: 'title', sortOrder: 'asc' },
  { value: 'title-desc', label: 'Title (Z-A)', sortBy: 'title', sortOrder: 'desc' },
  { value: 'dueDate-asc', label: 'Due date (soonest)', sortBy: 'dueDate', sortOrder: 'asc' },
  { value: 'dueDate-desc', label: 'Due date (latest)', sortBy: 'dueDate', sortOrder: 'desc' },
];

function AssessmentListPage() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<'' | AssessmentStatus>('');
  const [sortValue, setSortValue] = useState(DEFAULT_SORT_OPTION.value);
  const [page, setPage] = useState(1);

  const activeSort = SORT_OPTIONS.find((option) => option.value === sortValue) ?? DEFAULT_SORT_OPTION;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<AssessmentSummary | null>(null);
  const [duplicatingAssessment, setDuplicatingAssessment] = useState<AssessmentSummary | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState<AssessmentSummary | null>(null);

  const { data, isLoading, isError, refetch } = useAssessmentsQuery({
    page,
    pageSize: ASSESSMENTS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    sortBy: activeSort.sortBy,
    sortOrder: activeSort.sortOrder,
  });

  const updateStatus = useUpdateAssessmentStatusMutation();
  const deleteAssessment = useDeleteAssessmentMutation();

  const handleToggleStatus = async (assessment: AssessmentSummary) => {
    const nextStatus: AssessmentStatus = assessment.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT';
    try {
      await updateStatus.mutateAsync({ id: assessment.id, payload: { status: nextStatus } });
      const verb =
        nextStatus === 'PUBLISHED'
          ? 'published'
          : assessment.status === 'ARCHIVED'
            ? 'restored to draft'
            : 'unpublished';
      toast.success(`${assessment.title} ${verb}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleArchive = async (assessment: AssessmentSummary) => {
    try {
      await updateStatus.mutateAsync({ id: assessment.id, payload: { status: 'ARCHIVED' } });
      toast.success(`${assessment.title} archived.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deletingAssessment) return;
    try {
      await deleteAssessment.mutateAsync(deletingAssessment.id);
      toast.success(`${deletingAssessment.title} deleted.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingAssessment(null);
    }
  };

  if (isError) {
    return <ErrorScreen message="Failed to load assessments." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">Manage assessments.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Assessment
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search assessments..."
          containerClassName="w-64"
        />

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : (value as AssessmentStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortValue}
          onValueChange={(value) => {
            setSortValue(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Sort by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full animate-none animate-shimmer" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="No assessments found" description="Try adjusting your filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Passing %</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Assigned Groups</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <Link to={`${basePath}/assessments/${assessment.id}`} className="hover:underline">
                      {assessment.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AssessmentStatusBadge status={assessment.status} />
                  </TableCell>
                  <TableCell>{assessment.durationMinutes} min</TableCell>
                  <TableCell>{assessment.passingPercentage}%</TableCell>
                  <TableCell>{assessment._count.questions}</TableCell>
                  <TableCell>{assessment._count.groupAssignments}</TableCell>
                  <TableCell>{assessment._count.attempts}</TableCell>
                  <TableCell>{formatDate(assessment.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${assessment.title}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAssessment(assessment)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleToggleStatus(assessment)}>
                          {assessment.status === 'DRAFT'
                            ? 'Publish'
                            : assessment.status === 'PUBLISHED'
                              ? 'Unpublish'
                              : 'Restore to Draft'}
                        </DropdownMenuItem>
                        {assessment.status !== 'ARCHIVED' ? (
                          <DropdownMenuItem onClick={() => void handleArchive(assessment)}>Archive</DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => setDuplicatingAssessment(assessment)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`${basePath}/assessments/${assessment.id}/results`}>View Results</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingAssessment(assessment)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  Page {data.meta.page} of {Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={page * ASSESSMENTS_PAGE_SIZE >= data.meta.total}
                  className={
                    page * ASSESSMENTS_PAGE_SIZE >= data.meta.total
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

      <CreateAssessmentDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditAssessmentDialog
        assessment={editingAssessment}
        onOpenChange={(open) => !open && setEditingAssessment(null)}
      />

      <DuplicateAssessmentDialog
        assessment={duplicatingAssessment}
        onOpenChange={(open) => !open && setDuplicatingAssessment(null)}
      />

      <ConfirmDialog
        open={deletingAssessment !== null}
        onOpenChange={(open) => !open && setDeletingAssessment(null)}
        title="Delete assessment"
        description={`${deletingAssessment?.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { AssessmentListPage };
