import { ArrowRight, BadgeCheck, CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';

import { useQnaQuestionsQuery } from '../hooks';
import type { QnaQuestionListItem } from '../types';

const MAX_QUESTIONS_SHOWN = 5;

/**
 * Trainer dashboard Q&A moderation widget (Prompt 7 § DASHBOARD INTEGRATION) — two lists in
 * one card: "Unanswered questions" (`unanswered=true`) and "Pending verification"
 * (`pendingVerification=true`, answered but with no verified answer yet). Trainer-only
 * surface — mounted solely on `TrainerDashboardPage`, hence the hardcoded
 * `ROUTES.TRAINER.QNA` base path.
 */
function TrainerQnaWidget() {
  const unanswered = useQnaQuestionsQuery({
    unanswered: true,
    sortBy: 'newest',
    page: 1,
    pageSize: MAX_QUESTIONS_SHOWN,
  });
  const pendingVerification = useQnaQuestionsQuery({
    pendingVerification: true,
    sortBy: 'newest',
    page: 1,
    pageSize: MAX_QUESTIONS_SHOWN,
  });

  if (unanswered.isError || pendingVerification.isError) {
    return (
      <ErrorScreen
        message="Failed to load Q&A moderation queues."
        onRetry={() => {
          void unanswered.refetch();
          void pendingVerification.refetch();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Q&amp;A Moderation</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINER.QNA}>
            All questions <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <QuestionQueue
            heading="Unanswered questions"
            emptyText="Nothing waiting for a first answer."
            icon={<CircleHelp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            isLoading={unanswered.isLoading}
            questions={unanswered.data?.items ?? []}
          />
          <QuestionQueue
            heading="Pending verification"
            emptyText="No answers awaiting verification."
            icon={<BadgeCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            isLoading={pendingVerification.isLoading}
            questions={pendingVerification.data?.items ?? []}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface QuestionQueueProps {
  heading: string;
  emptyText: string;
  icon: React.ReactNode;
  isLoading: boolean;
  questions: QnaQuestionListItem[];
}

function QuestionQueue({ heading, emptyText, icon, isLoading, questions }: QuestionQueueProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{heading}</p>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((question) => (
            <li key={question.id}>
              <Link
                to={`${ROUTES.TRAINER.QNA}/${question.id}`}
                className="flex items-center gap-2 rounded-md text-sm hover:bg-muted/50"
              >
                {icon}
                <span className="truncate font-medium">{question.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { TrainerQnaWidget };
