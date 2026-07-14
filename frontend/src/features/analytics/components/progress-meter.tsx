import { cn } from '@/lib/utils';

import { formatPercent } from './format';
import { seqVar, seriesVar } from './viz-tokens';

export interface ProgressMeterProps {
  /** 0–100; values outside the range are clamped. */
  value: number;
  label?: string;
  className?: string;
}

/**
 * Thin single-value meter. The fill wears series slot 1 and the unfilled track a light step of
 * the SAME hue (seq-1), so the whole bar reads as one scale. The label and value text beside the
 * bar stay in text tokens — text never wears the series color.
 */
function ProgressMeter({ value, label, className }: ProgressMeterProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label ? <span className="shrink-0 text-xs text-muted-foreground">{label}</span> : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={label ?? 'Progress'}
        className="h-2 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: seqVar(1) }}
      >
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: seriesVar(1) }} />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
        {formatPercent(clamped)}
      </span>
    </div>
  );
}

export { ProgressMeter };
