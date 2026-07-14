import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { ChartTooltipContent } from './chart-tooltip';
import { formatNumber } from './format';
import { seriesVar, slotForIndex, VIZ_SURFACE } from './viz-tokens';

export interface PieChartDatum {
  name: string;
  value: number;
}

export interface AnalyticsPieChartProps {
  data: PieChartDatum[];
  height?: number;
  /** When set, the sum of all values renders in the donut center with this caption under it. */
  centerLabel?: string;
}

const MAX_SLICES = 6;
const LEGEND_HEIGHT = 32;

/** Sorts descending and folds everything past the top 5 into one 'Other' slice (max 6 slices). */
function foldSlices(data: PieChartDatum[]): PieChartDatum[] {
  if (data.length <= MAX_SLICES) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, MAX_SLICES - 1);
  const otherTotal = sorted.slice(MAX_SLICES - 1).reduce((sum, datum) => sum + datum.value, 0);
  return [...kept, { name: 'Other', value: otherTotal }];
}

// Legend text stays in text tokens — the colored swatch beside it carries identity.
function renderLegendText(value: unknown) {
  return <span className="text-xs text-muted-foreground">{String(value)}</span>;
}

/**
 * Donut for PART-TO-WHOLE AT A GLANCE ONLY — callers comparing close values should use
 * `AnalyticsBarChart` (or the numbers) instead. Max 6 slices (the tail folds into 'Other' —
 * never a generated 7th hue); slice fills follow the fixed series slots in order, separated by a
 * 2px surface-colored stroke. The legend always renders (a donut is multi-category by nature);
 * the optional center total wears text tokens, never a series color.
 */
function AnalyticsPieChart({ data, height = 260, centerLabel }: AnalyticsPieChartProps) {
  const slices = foldSlices(data);
  const total = slices.reduce((sum, datum) => sum + datum.value, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltipContent />} />
          <Legend
            verticalAlign="bottom"
            height={LEGEND_HEIGHT}
            iconType="circle"
            iconSize={8}
            formatter={renderLegendText}
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            stroke={VIZ_SURFACE}
            strokeWidth={2}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.name} fill={seriesVar(slotForIndex(index))} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel !== undefined ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center"
          style={{ height: height - LEGEND_HEIGHT }}
        >
          <span className="text-2xl font-semibold tracking-tight">{formatNumber(total)}</span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export { AnalyticsPieChart };
