import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltipContent } from './chart-tooltip';
import { seriesVar, slotForIndex, VIZ_AXIS, VIZ_GRID, VIZ_MUTED, VIZ_SURFACE } from './viz-tokens';
import type { ChartSeries } from './viz-tokens';

export interface AnalyticsLineChartProps {
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
 * Trend lines over a shared x axis. ONE y axis, always — two measures of different scale get two
 * charts, never a dual axis. Grid/axis rules are solid hairlines (never dashed) in the recessive
 * viz tokens; tick text wears the muted token. A legend renders only for >= 2 series (a single
 * series is named by the card title). No value labels on points — values surface through the
 * shared tooltip and the `ChartCard` `tableView` twin.
 */
function AnalyticsLineChart({ data, xKey, series, yDomain, height = 260 }: AnalyticsLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
        <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: VIZ_AXIS, strokeWidth: 1 }} />
        {series.length >= 2 ? <Legend iconType="circle" iconSize={8} formatter={renderLegendText} /> : null}
        {series.map((item, index) => {
          const color = seriesVar(slotForIndex(index, item.slot));
          return (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: VIZ_SURFACE, strokeWidth: 2 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export { AnalyticsLineChart };
