// Question bank management list — mounted at `{basePath}/questions` for both `/admin` and
// `/trainer` (same base-path detection as classroom/pages/course-list-page.tsx, which this page
// otherwise mirrors closely: filter bar, skeleton loading, empty state, and pagination all follow
// its exact patterns). Editing happens via a dialog rather than a detail route (question content
// is fully described by a handful of fields, unlike a course), so `basePath` is only used for the
// "Back to assessments" link back to the assessment builder this page is a sub-section of.
import { ArrowLeft, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';
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

import { CreateQuestionDialog } from '../components/create-question-dialog';
import { EditQuestionDialog } from '../components/edit-question-dialog';
import {
  QUESTION_TYPE_LABEL,
  QUESTION_TYPE_VALUES,
  QuestionTypeBadge,
} from '../components/question-type-badge';
import { useDeleteQuestionMutation, useQuestionsQuery, useUpdateQuestionStatusMutation } from '../hooks';
import type {
  QuestionCategory,
  QuestionDifficulty,
  QuestionSortField,
  QuestionStatus,
  QuestionSummary,
  QuestionType,
  SortOrder,
} from '../types';

const QUESTIONS_PAGE_SIZE = 10;

// `QuestionCategory`/`QuestionDifficulty`/`QuestionStatus` don't have a label glossary in the
// (currently empty) shared `constants/index.ts` yet — defined locally here (category/difficulty
// are also duplicated in create-question-dialog.tsx / edit-question-dialog.tsx) rather than
// editing that shared foundation file. Worth promoting to `constants/index.ts` in a follow-up.
const QUESTION_CATEGORY_VALUES = [
  'PYTHON',
  'SQL',
  'STATISTICS',
  'DATA_ANALYTICS',
  'MACHINE_LEARNING',
  'POWER_BI',
  'EXCEL',
  'SPARK',
  'HADOOP',
  'GENERAL',
] as const satisfies readonly QuestionCategory[];

const QUESTION_CATEGORY_LABEL: Record<QuestionCategory, string> = {
  PYTHON: 'Python',
  SQL: 'SQL',
  STATISTICS: 'Statistics',
  DATA_ANALYTICS: 'Data Analytics',
  MACHINE_LEARNING: 'Machine Learning',
  POWER_BI: 'Power BI',
  EXCEL: 'Excel',
  SPARK: 'Spark',
  HADOOP: 'Hadoop',
  GENERAL: 'General',
};

const QUESTION_DIFFICULTY_VALUES = [
  'EASY',
  'MEDIUM',
  'HARD',
] as const satisfies readonly QuestionDifficulty[];

const QUESTION_DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

const QUESTION_DIFFICULTY_VARIANT: Record<QuestionDifficulty, BadgeProps['variant']> = {
  EASY: 'success',
  MEDIUM: 'warning',
  HARD: 'destructive',
};

const QUESTION_STATUS_VALUES = ['ACTIVE', 'ARCHIVED'] as const satisfies readonly QuestionStatus[];

const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

const QUESTION_STATUS_VARIANT: Record<QuestionStatus, BadgeProps['variant']> = {
  ACTIVE: 'success',
  ARCHIVED: 'outline',
};

interface QuestionSortOption {
  value: string;
  label: string;
  sortBy: QuestionSortField;
  sortOrder: SortOrder;
}

const DEFAULT_SORT_OPTION: QuestionSortOption = {
  value: 'createdAt-desc',
  label: 'Newest first',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
const SORT_OPTIONS: QuestionSortOption[] = [
  DEFAULT_SORT_OPTION,
  { value: 'createdAt-asc', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'title-asc', label: 'Title (A-Z)', sortBy: 'title', sortOrder: 'asc' },
  { value: 'title-desc', label: 'Title (Z-A)', sortBy: 'title', sortOrder: 'desc' },
];

/** Truncates for the confirm-delete dialog message; the full title is already shown in the table. */
function truncateTitle(title: string, maxLength = 80): string {
  return title.length > maxLength ? `${title.slice(0, maxLength)}…` : title;
}

function buildDeleteDescription(question: QuestionSummary): string {
  const base = `"${truncateTitle(question.title)}" will be permanently deleted from the question bank.`;
  const usageCount = question._count.assessmentQuestions;
  if (usageCount > 0) {
    return `${base} It is already used in ${usageCount} assessment${usageCount === 1 ? '' : 's'} — those keep their own copy of this content and won't be affected, but this bank entry won't be available for future reuse.`;
  }
  return base;
}

function QuestionBankPage() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState<'' | QuestionCategory>('');
  const [difficulty, setDifficulty] = useState<'' | QuestionDifficulty>('');
  const [type, setType] = useState<'' | QuestionType>('');
  const [status, setStatus] = useState<'' | QuestionStatus>('');
  const [sortValue, setSortValue] = useState(DEFAULT_SORT_OPTION.value);
  const [page, setPage] = useState(1);

  const activeSort = SORT_OPTIONS.find((option) => option.value === sortValue) ?? DEFAULT_SORT_OPTION;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionSummary | null>(null);

  const { data, isLoading, isError, refetch } = useQuestionsQuery({
    page,
    pageSize: QUESTIONS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    category: category || undefined,
    difficulty: difficulty || undefined,
    type: type || undefined,
    status: status || undefined,
    sortBy: activeSort.sortBy,
    sortOrder: activeSort.sortOrder,
  });

  const updateStatus = useUpdateQuestionStatusMutation();
  const deleteQuestion = useDeleteQuestionMutation();

  const handleToggleStatus = async (question: QuestionSummary) => {
    const nextStatus: QuestionStatus = question.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await updateStatus.mutateAsync({ id: question.id, payload: { status: nextStatus } });
      toast.success(`Question ${nextStatus === 'ARCHIVED' ? 'archived' : 'restored'}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deletingQuestion) return;
    try {
      await deleteQuestion.mutateAsync(deletingQuestion.id);
      toast.success('Question deleted.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingQuestion(null);
    }
  };

  if (isError) {
    return <ErrorScreen message="Failed to load questions." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Link
        to={`${basePath}/assessments`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to Assessments
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">Manage reusable questions for assessments.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Question
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search questions..."
          containerClassName="w-64"
        />

        <Select
          value={category || 'all'}
          onValueChange={(value) => {
            setCategory(value === 'all' ? '' : (value as QuestionCategory));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {QUESTION_CATEGORY_VALUES.map((option) => (
              <SelectItem key={option} value={option}>
                {QUESTION_CATEGORY_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficulty || 'all'}
          onValueChange={(value) => {
            setDifficulty(value === 'all' ? '' : (value as QuestionDifficulty));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by difficulty">
            <SelectValue placeholder="All difficulties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            {QUESTION_DIFFICULTY_VALUES.map((option) => (
              <SelectItem key={option} value={option}>
                {QUESTION_DIFFICULTY_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type || 'all'}
          onValueChange={(value) => {
            setType(value === 'all' ? '' : (value as QuestionType));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {QUESTION_TYPE_VALUES.map((option) => (
              <SelectItem key={option} value={option}>
                {QUESTION_TYPE_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : (value as QuestionStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUESTION_STATUS_VALUES.map((option) => (
              <SelectItem key={option} value={option}>
                {QUESTION_STATUS_LABEL[option]}
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
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          title="No questions found"
          description="Try adjusting your filters, or create a new question."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used in</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((question) => (
                <TableRow key={question.id}>
                  <TableCell className="max-w-xs font-medium">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left hover:underline"
                      onClick={() => setEditingQuestionId(question.id)}
                    >
                      {question.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <QuestionTypeBadge type={question.type} />
                  </TableCell>
                  <TableCell>{QUESTION_CATEGORY_LABEL[question.category]}</TableCell>
                  <TableCell>
                    <Badge variant={QUESTION_DIFFICULTY_VARIANT[question.difficulty]}>
                      {QUESTION_DIFFICULTY_LABEL[question.difficulty]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={QUESTION_STATUS_VARIANT[question.status]}>
                      {QUESTION_STATUS_LABEL[question.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{question._count.assessmentQuestions}</TableCell>
                  <TableCell>{formatDate(question.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${question.title}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingQuestionId(question.id)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleToggleStatus(question)}>
                          {question.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingQuestion(question)}
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
                  aria-disabled={page * QUESTIONS_PAGE_SIZE >= data.meta.total}
                  className={
                    page * QUESTIONS_PAGE_SIZE >= data.meta.total
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

      <CreateQuestionDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditQuestionDialog
        questionId={editingQuestionId}
        onOpenChange={(open) => !open && setEditingQuestionId(null)}
      />

      <ConfirmDialog
        open={deletingQuestion !== null}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
        title="Delete question"
        description={deletingQuestion ? buildDeleteDescription(deletingQuestion) : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { QuestionBankPage };
