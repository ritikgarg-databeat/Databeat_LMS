import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltipContent } from './chart-tooltip';
import { seriesVar, slotForIndex, VIZ_AXIS, VIZ_GRID, VIZ_MUTED } from './viz-tokens';
import type { ChartSeries } from './viz-tokens';

export interface AnalyticsBarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  /** Max 8 series — fold anything beyond that into 'Other'; slots are never cycled. */
  series: ChartSeries[];
  /** Y-axis domain, e.g. `[0, 100]` for percentages. Defaults to Recharts auto. */
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  height?: number;
}

// Legend text stays in text tokens — the colored swatch beside it carries identity.
function renderLegendText(value: unknown) {
  return <span className="text-xs text-muted-foreground">{String(value)}</span>;
}

/**
 * Columns from a single baseline: thin bars (max 24px), 4px rounded at the data end and square at
 * the baseline, a 2px surface gap between adjacent grouped bars. ONE y axis, always — never a
 * dual axis. Grid/axis rules are solid hairlines (never dashed); tick text wears the muted token.
 * A legend renders only for >= 2 series. No value label on every bar — values surface through
 * the shared tooltip and the `ChartCard` `tableView` twin.
 */
function AnalyticsBarChart({ data, xKey, series, yDomain, height = 260 }: AnalyticsBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid stroke={VIZ_GRID} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: VIZ_MUTED, fontSize: 12 }}
          axisLine={{ stroke: VIZ_AXIS }}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fill: VIZ_MUTED, fontSize: 12 }}
          axisLine={{ stroke: VIZ_AXIS }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: VIZ_GRID, fillOpacity: 0.4 }} />
        {series.length >= 2 ? <Legend iconType="circle" iconSize={8} formatter={renderLegendText} /> : null}
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            fill={seriesVar(slotForIndex(index, item.slot))}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export { AnalyticsBarChart };
