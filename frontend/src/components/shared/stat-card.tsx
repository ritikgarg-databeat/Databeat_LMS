import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  isLoading?: boolean;
  className?: string;
  /**
   * Optional CSS color value (e.g. `var(--viz-series-3)`, `var(--primary)`) used to tint the
   * icon chip — a soft `color-mix` background plus a solid-color icon, in place of the default
   * neutral `bg-muted` treatment. Left unset, existing call sites (group/classroom/assessment
   * stat rows) render exactly as before; dashboard overview rows opt in per-card so each metric
   * reads as a distinct small data display rather than a wall of identical gray tiles.
   */
  accentColor?: string;
}

/** Compact metric tile for dashboard summary rows (Prompt 4 § DASHBOARD CARDS — reusable). */
function StatCard({ label, value, icon: Icon, isLoading, className, accentColor }: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-semibold tracking-tight">{value}</p>}
        </div>
        <div
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', !accentColor && 'bg-muted')}
          style={accentColor ? { backgroundColor: `color-mix(in oklch, ${accentColor} 16%, transparent)` } : undefined}
        >
          <Icon
            className={cn('size-5', !accentColor && 'text-muted-foreground')}
            style={accentColor ? { color: accentColor } : undefined}
            aria-hidden
          />
        </div>
      </CardContent>
    </Card>
  );
}

export { StatCard };
