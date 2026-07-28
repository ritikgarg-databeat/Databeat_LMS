/** Formatting helpers for durations reported by the timing-observations / impact-metrics
 * features — shared so "24 min", "7.2s" etc. render identically across both. */

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return formatSeconds(ms / 1000);
}
