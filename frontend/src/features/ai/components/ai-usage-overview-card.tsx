import { ArrowDownToLine, ArrowUpFromLine, MessagesSquare, MessageSquareText, Users } from 'lucide-react';

import { ErrorScreen, StatCard } from '@/components/shared';

import { useAiUsageQuery } from '../hooks';

/**
 * Trainer dashboard "AI usage overview" row (Prompt 7 § DASHBOARD INTEGRATION) — org-wide
 * aggregates from the staff-only `GET /ai/usage` endpoint. Mount only on Trainer/Super-Admin
 * surfaces; the API 403s for trainees.
 */
function AiUsageOverviewCard() {
  const { data, isLoading, isError, refetch } = useAiUsageQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load AI usage statistics." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">AI Usage Overview</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Conversations"
          value={data?.totalConversations ?? 0}
          icon={MessagesSquare}
          isLoading={isLoading}
        />
        <StatCard label="Messages" value={data?.totalMessages ?? 0} icon={MessageSquareText} isLoading={isLoading} />
        <StatCard
          label="Input Tokens"
          value={data?.totalInputTokens ?? 0}
          icon={ArrowDownToLine}
          isLoading={isLoading}
        />
        <StatCard
          label="Output Tokens"
          value={data?.totalOutputTokens ?? 0}
          icon={ArrowUpFromLine}
          isLoading={isLoading}
        />
        <StatCard label="Active Users" value={data?.activeUsers ?? 0} icon={Users} isLoading={isLoading} />
      </div>
    </div>
  );
}

export { AiUsageOverviewCard };
