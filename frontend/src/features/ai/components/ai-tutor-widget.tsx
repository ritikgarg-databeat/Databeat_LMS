import { ArrowRight, MessageSquare, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/utils/date';

import { useAiHistoryQuery } from '../hooks';

const MAX_CONVERSATIONS_SHOWN = 5;

/**
 * Trainee dashboard widget covering two Prompt 7 § DASHBOARD INTEGRATION items in one card:
 * the "Ask AI" shortcut (header button) and "Recent AI conversations" (the list, each row
 * resuming its conversation via the same `?conversationId=` param `AiHistoryPage` uses).
 * Trainee-only surface — mounted solely on `TraineeDashboardPage`.
 */
function AiTutorWidget() {
  const { data, isLoading, isError, refetch } = useAiHistoryQuery({
    page: 1,
    pageSize: MAX_CONVERSATIONS_SHOWN,
  });

  if (isError) {
    return <ErrorScreen message="Failed to load AI conversations." onRetry={() => void refetch()} />;
  }

  const conversations = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>AI Tutor</CardTitle>
        <Button asChild size="sm">
          <Link to={ROUTES.TRAINEE.AI_TUTOR}>
            <Sparkles /> Ask AI
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
        ) : conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No conversations yet. Ask the AI Tutor anything about your lessons to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`${ROUTES.TRAINEE.AI_TUTOR}?conversationId=${conversation.id}`}
                  className="flex items-center justify-between gap-3 rounded-md text-sm hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium">{conversation.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {formatDate(conversation.updatedAt)}
                    <ArrowRight className="size-3.5" aria-hidden />
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

export { AiTutorWidget };
