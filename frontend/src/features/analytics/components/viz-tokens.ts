// CSS custom-property accessors for the `--viz-*` tokens appended to src/styles/globals.css.
//
// Charts consume these as `var(--viz-...)` strings in Recharts fill/stroke props — SVG resolves
// CSS variables, so toggling the app's `.dark` class re-themes every chart with zero JS theme
// plumbing.
//
// THE DATAVIZ CONTRACT (binding for every chart in this feature):
// - SLOT ORDER IS LOAD-BEARING. `--viz-series-1..8` is a fixed categorical order validated for
//   adjacent-pair colorblind separation. Never reorder or cycle slots, and never generate a 9th
//   hue — past 8 series, fold the tail into 'Other' or split into small multiples. A series
//   keeps its slot across filters (color follows the entity, never its rank).
// - Dark-mode separation sits in a floor band, so color is never the only identity channel:
//   every multi-series chart carries a legend (and ChartCard provides the table twin).
// - ONE y axis, always. Two measures of different scale → two charts, never a second axis.
// - Text (labels, values, legends, ticks) wears text tokens — never a series color.
// - Grid/axis lines are solid hairlines (never dashed); the sequential ramp encodes magnitude
//   only (heatmap), never identity.
//
// Kept in a non-component module so component files export only components
// (react-refresh/only-export-components).

/** Fixed categorical color slot (1-based). The order is the colorblind-safety mechanism. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Sequential-ramp step (1 = lightest … 7 = darkest). Magnitude encodings only — never identity. */
export type SequentialStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** One plotted series: `key` into the data rows, human-readable `label`, optional fixed slot. */
export interface ChartSeries {
  key: string;
  label: string;
  /**
   * Fixed color slot; defaults to the series' 1-based position. Pin it when a chart's series
   * set can change (filters), so a surviving series never gets repainted.
   */
  slot?: SeriesSlot;
}

export function seriesVar(slot: SeriesSlot): string {
  return `var(--viz-series-${slot})`;
}

export function seqVar(step: SequentialStep): string {
  return `var(--viz-seq-${step})`;
}

export const VIZ_GRID = 'var(--viz-grid)';
export const VIZ_AXIS = 'var(--viz-axis)';
export const VIZ_MUTED = 'var(--viz-muted)';

/** Chart surface color — the 2px "surface gap/ring" spacer (donut slice strokes, active dots). */
export const VIZ_SURFACE = 'var(--card)';

/**
 * Resolves a series' slot: the explicit pin wins, otherwise its 1-based position. Clamped to 8 —
 * but callers must not plot more than 8 series (fold into 'Other' instead); the clamp only
 * guards against an invalid `var()` reference, it is NOT a cycling mechanism.
 */
export function slotForIndex(index: number, explicit?: SeriesSlot): SeriesSlot {
  if (explicit) return explicit;
  return (Math.min(Math.max(index, 0), 7) + 1) as SeriesSlot;
}
