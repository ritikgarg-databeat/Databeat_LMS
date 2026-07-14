import type { LucideIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';

export type RecentActivityTone = 'default' | 'success' | 'warning' | 'destructive';

export interface RecentActivityItem {
  id: string;
  icon: LucideIcon;
  text: string;
  /** ISO timestamp; omit for summary-style rows with no single point in time (e.g. a pending count). */
  timestamp?: string | null;
  tone?: RecentActivityTone;
}

export interface RecentActivityWidgetProps {
  title?: string;
  items: RecentActivityItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}

const TONE_ICON_CLASS: Record<RecentActivityTone, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

/**
 * Generic "Recent Activity" feed (Prompt 9 § Part A) — purely presentational, no query of its own.
 * Callers derive `items` from dashboard data they already have; see trainee/trainer dashboard pages
 * for exactly which existing fields each role's list is built from.
 */
function RecentActivityWidget({
  title = 'Recent Activity',
  items,
  emptyTitle = 'No recent activity',
  emptyDescription = "Activity will show up here once there's something to report.",
}: RecentActivityWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <Icon
                    className={cn('mt-0.5 size-4 shrink-0', TONE_ICON_CLASS[item.tone ?? 'default'])}
                    aria-hidden
                  />
                  <span className="flex-1 text-foreground">{item.text}</span>
                  {item.timestamp ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { RecentActivityWidget };
