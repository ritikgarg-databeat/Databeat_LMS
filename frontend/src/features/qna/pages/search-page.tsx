// Q&A search — a single box searching across questions, tags, courses, and lessons at once
// (distinct from the feed page's own `search` filter, which only substring-matches questions).
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';

import { QuestionCard } from '../components/question-card';
import { useQnaSearchQuery } from '../hooks';

const SEARCH_RESULT_LIMIT = 20;

function SearchPage() {
  const isTraineeRoute = useLocation().pathname.startsWith('/trainee');
  const qnaBasePath = isTraineeRoute ? ROUTES.TRAINEE.QNA : ROUTES.TRAINER.QNA;
  const classroomBasePath = isTraineeRoute ? ROUTES.TRAINEE.CLASSROOM : ROUTES.TRAINER.CLASSROOM;

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(query);

  const { data, isLoading } = useQnaSearchQuery({ q: query, limit: SEARCH_RESULT_LIMIT });

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  const hasQuery = Boolean(query);
  const hasResults = Boolean(
    data && (data.questions.length || data.tags.length || data.courses.length || data.lessons.length),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground">Search across questions, tags, courses, and lessons.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-xl items-center gap-2">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Search Q&A, tags, courses, lessons..."
        />
        <Button type="submit">
          <Search />
          Search
        </Button>
      </form>

      {!hasQuery ? (
        <EmptyState
          icon={Search}
          title="Search the Q&A platform"
          description="Enter a search term above to find questions, tags, courses, and lessons."
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !hasResults ? (
        <EmptyState title={`No results found for "${query}"`} description="Try a different search term." />
      ) : (
        <div className="space-y-8">
          {data && data.questions.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Questions</h2>
              <div className="space-y-3">
                {data.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    detailHref={`${qnaBasePath}/${question.id}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data && data.tags.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <Link key={tag.id} to={`${qnaBasePath}?tag=${encodeURIComponent(tag.name)}`}>
                    <Badge variant="secondary" className="font-normal">
                      {tag.name} ({tag.questionCount})
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {data && data.courses.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Courses</h2>
              <ul className="space-y-1.5">
                {data.courses.map((course) => (
                  <li key={course.id}>
                    <Link
                      to={`${classroomBasePath}/${course.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {course.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data && data.lessons.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Lessons</h2>
              <ul className="space-y-1.5">
                {data.lessons.map((lesson) => (
                  <li key={lesson.id} className="text-sm text-muted-foreground">
                    {/*
                      A lesson result only carries {id, title} — the lesson-viewer route needs
                      BOTH courseId and lessonId (see routes/router.tsx's
                      `classroom/:courseId/lessons/:lessonId`), so there's no way to build a
                      working link from this result alone. Plain text beats a broken link.
                    */}
                    {lesson.title}
                    <span className="ml-1 text-xs">(open its course to view)</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

export { SearchPage };
