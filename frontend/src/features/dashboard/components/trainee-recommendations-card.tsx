import {
  AlertTriangle,
  ClipboardList,
  GraduationCap,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsInsightKind, AnalyticsInsights } from '@/features/analytics/types';
import { formatRelativeTime } from '@/utils/date';

const KIND_ICON: Record<AnalyticsInsightKind, LucideIcon> = {
  WEAK_TOPIC: AlertTriangle,
  SUGGESTED_LESSON: GraduationCap,
  SUGGESTED_ASSESSMENT: ClipboardList,
  GENERAL: Lightbulb,
};

export interface TraineeRecommendationsCardProps {
  recommendations: AnalyticsInsights;
}

/**
 * AI (or heuristic-fallback) recommendations card — shared by the trainee dashboard and the
 * My Performance page (the `/analytics/me` payload has no recommendations of its own, so that
 * page reuses the trainee dashboard query purely for this field).
 */
function TraineeRecommendationsCard({ recommendations }: TraineeRecommendationsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden />
          AI Recommendations
        </CardTitle>
        <Badge variant="outline">{recommendations.source === 'HEURISTIC' ? 'Rule-based' : 'AI'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommendations yet — complete more lessons to get personalized suggestions.
          </p>
        ) : (
          <>
            <ul className="space-y-2.5">
              {recommendations.insights.map((insight, index) => {
                const Icon = KIND_ICON[insight.kind];
                return (
                  <li key={index} className="flex items-start gap-2.5 text-sm">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{insight.text}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Generated {formatRelativeTime(recommendations.generatedAt)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { TraineeRecommendationsCard };
