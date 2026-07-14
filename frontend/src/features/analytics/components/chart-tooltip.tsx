import { formatNumber } from './format';

interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  dataKey?: string | number;
}

/**
 * Structural subset of the props Recharts injects into a custom `<Tooltip content={...}>`
 * element. Kept local (all-optional) so `<ChartTooltipContent />` can be created bare —
 * Recharts clones the element and fills these in at render time.
 */
export interface ChartTooltipContentProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<ChartTooltipEntry>;
}

function formatEntryValue(value: ChartTooltipEntry['value']): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'number' ? formatNumber(item) : String(item))).join(' – ');
  }
  return '—';
}

/**
 * Shared card-styled tooltip content for every Recharts chart in this feature — pass as
 * `<Tooltip content={<ChartTooltipContent />} />`.
 *
 * Identity comes from the 8px color dot beside each row; the text itself stays in
 * popover-foreground/muted tokens (text never wears the series color). Values are compacted via
 * `formatNumber`. Tooltips ENHANCE, never gate: every chart using this must also expose its
 * values through `ChartCard`'s `tableView` twin.
 */
function ChartTooltipContent({ active, label, payload }: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      {label !== undefined && label !== '' ? <p className="mb-1 font-medium">{label}</p> : null}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={String(entry.dataKey ?? entry.name ?? index)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name !== undefined ? <span className="text-muted-foreground">{entry.name}</span> : null}
            <span className="ml-auto pl-3 font-medium tabular-nums">{formatEntryValue(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ChartTooltipContent };
