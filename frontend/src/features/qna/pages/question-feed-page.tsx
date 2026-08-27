// Q&A feed — filterable/sortable/paginated list of questions, mirroring the established
// filter-row + pagination pattern from assessment-list-page.tsx / groups-list-page.tsx, but
// rendering `QuestionCard`s in a vertical list instead of a `<Table>` (per Prompt 7's "Feed
// layout" requirement).
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';

import { QuestionCard } from '../components/question-card';
import { useQnaQuestionsQuery, useQnaTagsQuery } from '../hooks';
import type { QnaQuestionStatus } from '../types';

const QUESTIONS_PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: QnaQuestionStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SOLVED', label: 'Solved' },
  { value: 'CLOSED', label: 'Closed' },
];

const SORT_OPTIONS: { value: 'newest' | 'votes'; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'votes', label: 'Most voted' },
];

function QuestionFeedPage() {
  const isTraineeRoute = useLocation().pathname.startsWith('/trainee');
  const basePath = isTraineeRoute ? ROUTES.TRAINEE.QNA : ROUTES.TRAINER.QNA;

  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<'' | QnaQuestionStatus>('');
  // Deep-linked from the Search page's tag chips (`?tag=name`) — read once on mount, same as any
  // other filter's initial state.
  const [tag, setTag] = useState(() => searchParams.get('tag') ?? '');
  const [sortBy, setSortBy] = useState<'newest' | 'votes'>('newest');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQnaQuestionsQuery({
    page,
    pageSize: QUESTIONS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    tag: tag || undefined,
    sortBy,
  });
  const { data: tags } = useQnaTagsQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load questions." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
          <p className="text-muted-foreground">Ask questions and get help from trainers and peers.</p>
        </div>
        <Button asChild>
          <Link to={`${basePath}/ask`}>
            <Plus />
            Ask Question
          </Link>
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
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : (value as QnaQuestionStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={tag || 'all'}
          onValueChange={(value) => {
            setTag(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by tag">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags?.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.name} ({t.questionCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value as 'newest' | 'votes');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
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
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          title="No questions yet — be the first to ask!"
          description="Try adjusting your filters, or ask a new question."
          action={
            <Button asChild size="sm">
              <Link to={`${basePath}/ask`}>Ask Question</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((question) => (
              <QuestionCard key={question.id} question={question} detailHref={`${basePath}/${question.id}`} />
            ))}
          </div>

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
    </div>
  );
}

export { QuestionFeedPage };
