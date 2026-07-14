import { cn } from '@/lib/utils';

export interface CourseProgressBarProps {
  /** 0-100. Clamped and rounded defensively in case the backend ever sends a stray value. */
  percentage: number;
  className?: string;
}

/**
 * Small, local, presentational progress bar for the classroom feature — a filled track plus a
 * percentage label. Not part of the shared design system; feature-local by design.
 */
function CourseProgressBar({ percentage, className }: CourseProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-2 w-full flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium text-muted-foreground">{clamped}%</span>
    </div>
  );
}

export { CourseProgressBar };
