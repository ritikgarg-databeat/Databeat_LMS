import { AlertTriangle, ClipboardList, GraduationCap, Lightbulb, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyticsInsightKind, AnalyticsInsights } from '@/features/analytics/types';
import { formatRelativeTime } from '@/utils/date';

export interface TrainerInsightsCardProps {
  insights: AnalyticsInsights | undefined;
  isLoading: boolean;
}

const KIND_ICONS: Record<AnalyticsInsightKind, LucideIcon> = {
  WEAK_TOPIC: AlertTriangle,
  SUGGESTED_LESSON: GraduationCap,
  SUGGESTED_ASSESSMENT: ClipboardList,
  GENERAL: Lightbulb,
};

/** Trainer dashboard "AI Insights" card (Prompt 8) — same visual language as a recommendations card. */
function TrainerInsightsCard({ insights, isLoading }: TrainerInsightsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>AI Insights</CardTitle>
          {insights ? (
            <CardDescription>Generated {formatRelativeTime(insights.generatedAt)}</CardDescription>
          ) : null}
        </div>
        {insights ? (
          <Badge variant={insights.source === 'AI' ? 'default' : 'secondary'} className="shrink-0">
            <Sparkles className="mr-1 size-3" aria-hidden />
            {insights.source === 'AI' ? 'AI' : 'Rule-based'}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !insights || insights.insights.length === 0 ? (
          <EmptyState icon={Lightbulb} title="Not enough activity data yet." />
        ) : (
          <ul className="space-y-3">
            {insights.insights.map((insight, index) => {
              const Icon = KIND_ICONS[insight.kind];
              return (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-foreground">{insight.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { TrainerInsightsCard };
