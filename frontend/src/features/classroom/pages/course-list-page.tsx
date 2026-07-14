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

import { CourseStatusBadge, DifficultyBadge } from '../components';
import { CreateCourseDialog } from '../components/create-course-dialog';
import { DuplicateCourseDialog } from '../components/duplicate-course-dialog';
import { EditCourseDialog } from '../components/edit-course-dialog';
import { COURSES_PAGE_SIZE, DIFFICULTY_OPTIONS, STATUS_OPTIONS } from '../constants';
import { useCoursesQuery, useDeleteCourseMutation, useUpdateCourseStatusMutation } from '../hooks';
import type { CourseDifficulty, CourseSortField, CourseStatus, CourseSummary, SortOrder } from '../types';

interface CourseSortOption {
  value: string;
  label: string;
  sortBy: CourseSortField;
  sortOrder: SortOrder;
}

/** Combines `CourseSortField` + `SortOrder` into a single dropdown, rather than two selects. */
const DEFAULT_SORT_OPTION: CourseSortOption = {
  value: 'createdAt-desc',
  label: 'Newest first',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
const SORT_OPTIONS: CourseSortOption[] = [
  DEFAULT_SORT_OPTION,
  { value: 'createdAt-asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'title-asc', label: 'Title (A-Z)', sortBy: 'title', sortOrder: 'asc' },
  { value: 'title-desc', label: 'Title (Z-A)', sortBy: 'title', sortOrder: 'desc' },
];

function CourseListPage() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<'' | CourseStatus>('');
  const [difficulty, setDifficulty] = useState<'' | CourseDifficulty>('');
  const [sortValue, setSortValue] = useState(DEFAULT_SORT_OPTION.value);
  const [page, setPage] = useState(1);

  const activeSort = SORT_OPTIONS.find((option) => option.value === sortValue) ?? DEFAULT_SORT_OPTION;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseSummary | null>(null);
  const [duplicatingCourse, setDuplicatingCourse] = useState<CourseSummary | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<CourseSummary | null>(null);

  const { data, isLoading, isError, refetch } = useCoursesQuery({
    page,
    pageSize: COURSES_PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    difficulty: difficulty || undefined,
    sortBy: activeSort.sortBy,
    sortOrder: activeSort.sortOrder,
  });

  const updateStatus = useUpdateCourseStatusMutation();
  const deleteCourse = useDeleteCourseMutation();

  const handleToggleStatus = async (course: CourseSummary) => {
    const nextStatus: CourseStatus = course.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT';
    try {
      await updateStatus.mutateAsync({ id: course.id, payload: { status: nextStatus } });
      const verb =
        nextStatus === 'PUBLISHED' ? 'published' : course.status === 'ARCHIVED' ? 'restored to draft' : 'unpublished';
      toast.success(`${course.title} ${verb}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleArchive = async (course: CourseSummary) => {
    try {
      await updateStatus.mutateAsync({ id: course.id, payload: { status: 'ARCHIVED' } });
      toast.success(`${course.title} archived.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;
    try {
      await deleteCourse.mutateAsync(deletingCourse.id);
      toast.success(`${deletingCourse.title} deleted.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingCourse(null);
    }
  };

  if (isError) {
    return <ErrorScreen message="Failed to load courses." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classroom</h1>
          <p className="text-muted-foreground">Manage courses.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Course
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search courses..."
          containerClassName="w-64"
        />

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : (value as CourseStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-auto min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || 'all'}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficulty || 'all'}
          onValueChange={(value) => {
            setDifficulty(value === 'all' ? '' : (value as CourseDifficulty));
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-auto min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || 'all'}>
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
          <SelectTrigger className="h-9 w-auto min-w-40">
            <SelectValue />
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
        <EmptyState title="No courses found" description="Try adjusting your filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead>Assigned Groups</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">
                    <Link to={`${basePath}/classroom/${course.id}`} className="hover:underline">
                      {course.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CourseStatusBadge status={course.status} />
                  </TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={course.difficulty} />
                  </TableCell>
                  <TableCell>{course.department?.name ?? '—'}</TableCell>
                  <TableCell>{course.moduleCount}</TableCell>
                  <TableCell>{course.lessonCount}</TableCell>
                  <TableCell>{course.assignedGroupsCount}</TableCell>
                  <TableCell>{formatDate(course.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${course.title}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingCourse(course)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleToggleStatus(course)}>
                          {course.status === 'DRAFT'
                            ? 'Publish'
                            : course.status === 'PUBLISHED'
                              ? 'Unpublish'
                              : 'Restore to Draft'}
                        </DropdownMenuItem>
                        {course.status !== 'ARCHIVED' ? (
                          <DropdownMenuItem onClick={() => void handleArchive(course)}>Archive</DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => setDuplicatingCourse(course)}>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingCourse(course)}
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
                  aria-disabled={page * COURSES_PAGE_SIZE >= data.meta.total}
                  className={
                    page * COURSES_PAGE_SIZE >= data.meta.total ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}

      <CreateCourseDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditCourseDialog course={editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)} />

      <DuplicateCourseDialog
        course={duplicatingCourse}
        onOpenChange={(open) => !open && setDuplicatingCourse(null)}
      />

      <ConfirmDialog
        open={deletingCourse !== null}
        onOpenChange={(open) => !open && setDeletingCourse(null)}
        title="Delete course"
        description={`${deletingCourse?.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { CourseListPage };
