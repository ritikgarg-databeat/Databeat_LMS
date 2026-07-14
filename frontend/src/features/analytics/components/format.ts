// Tiny value formatters shared by the analytics chart primitives (and reusable by pages).
// Kept in a non-component module so component files export only components
// (react-refresh/only-export-components).

/** Compacts large values: `1284` → `'1,284'`, `12940` → `'12.9K'`, `3200000` → `'3.2M'`. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${toCompactDigits(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${toCompactDigits(value / 1_000)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function toCompactDigits(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** Whole-number percent: `74.4` → `'74%'`. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Seconds → compact duration: `2700` → `'45m'`, `7200` → `'2h'`, `5400` → `'1h 30m'`. */
export function formatHours(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
