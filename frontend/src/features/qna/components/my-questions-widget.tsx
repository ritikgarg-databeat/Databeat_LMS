import { ArrowRight, CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';

import { useQnaQuestionsQuery } from '../hooks';

import { QuestionStatusBadge } from './question-status-badge';

const MAX_QUESTIONS_SHOWN = 5;

/**
 * Trainee dashboard "My questions" widget (Prompt 7 § DASHBOARD INTEGRATION) — the caller's
 * own most recent questions via the `mine=true` list filter (applied server-side by actor id).
 * Trainee-only surface — mounted solely on `TraineeDashboardPage`, hence the hardcoded
 * `ROUTES.TRAINEE.QNA` base path.
 */
function MyQuestionsWidget() {
  const { data, isLoading, isError, refetch } = useQnaQuestionsQuery({
    mine: true,
    sortBy: 'newest',
    page: 1,
    pageSize: MAX_QUESTIONS_SHOWN,
  });

  if (isError) {
    return <ErrorScreen message="Failed to load your questions." onRetry={() => void refetch()} />;
  }

  const questions = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>My Questions</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={`${ROUTES.TRAINEE.QNA}/ask`}>
            Ask a question <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not asked any questions yet. Stuck on something? The community can help.
          </p>
        ) : (
          <ul className="space-y-2">
            {questions.map((question) => (
              <li key={question.id}>
                <Link
                  to={`${ROUTES.TRAINEE.QNA}/${question.id}`}
                  className="flex items-center justify-between gap-3 rounded-md text-sm hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CircleHelp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium">{question.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {question.answersCount} {question.answersCount === 1 ? 'answer' : 'answers'}
                    <QuestionStatusBadge status={question.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { MyQuestionsWidget };
