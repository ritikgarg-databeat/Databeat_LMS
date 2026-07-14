import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';

import { useQnaQuestionsQuery } from '../hooks';

import { VerifiedBadge } from './verified-badge';

const MAX_QUESTIONS_SHOWN = 5;

/**
 * Trainee dashboard "Recent verified answers" widget (Prompt 7 § DASHBOARD INTEGRATION),
 * surfaced as recently SOLVED questions: verifying an answer auto-promotes its question to
 * SOLVED (see backend qna-answers.service.ts), so "questions solved recently" and "answers
 * verified recently" are the same set — this avoids a bespoke answers-feed endpoint. The list
 * is visibility-scoped server-side like every question list.
 */
function RecentVerifiedAnswersWidget() {
  const { data, isLoading, isError, refetch } = useQnaQuestionsQuery({
    status: 'SOLVED',
    sortBy: 'newest',
    page: 1,
    pageSize: MAX_QUESTIONS_SHOWN,
  });

  if (isError) {
    return <ErrorScreen message="Failed to load verified answers." onRetry={() => void refetch()} />;
  }

  const questions = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Recent Verified Answers</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.QNA}>
            Browse Q&amp;A <ArrowRight />
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
          <p className="text-sm text-muted-foreground">No verified answers yet.</p>
        ) : (
          <ul className="space-y-2">
            {questions.map((question) => (
              <li key={question.id}>
                <Link
                  to={`${ROUTES.TRAINEE.QNA}/${question.id}`}
                  className="flex items-center justify-between gap-3 rounded-md text-sm hover:bg-muted/50"
                >
                  <span className="truncate font-medium">{question.title}</span>
                  <VerifiedBadge className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { RecentVerifiedAnswersWidget };
