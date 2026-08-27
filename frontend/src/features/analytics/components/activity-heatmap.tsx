import { cn } from '@/lib/utils';

import type { DailyActivityPoint } from '../types';

import { seqVar } from './viz-tokens';

export interface ActivityHeatmapProps {
  data: DailyActivityPoint[];
  /** How many trailing weeks to render (default 13 ≈ one quarter). */
  weeks?: number;
  className?: string;
}

interface HeatmapCell {
  key: string;
  date: Date;
  total: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface HeatmapColumn {
  key: string;
  cells: HeatmapCell[];
}

// Sequential-ramp steps for levels 1–4 (level 0 renders as a transparent hairline-bordered cell).
const LEVEL_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: seqVar(1),
  2: seqVar(3),
  3: seqVar(5),
  4: seqVar(7),
};

// Mon-first rows; only Mon/Wed/Fri get a visible label to keep the gutter quiet.
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

function totalEvents(point: DailyActivityPoint): number {
  return (
    point.logins + point.lessonsCompleted + point.assessmentsSubmitted + point.aiMessages + point.qnaPosts
  );
}

function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` key as a LOCAL date (never `new Date(string)` — that parses as UTC). */
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday-first weekday index: Mon=0 … Sun=6. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function bucketLevel(total: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((total / max) * 4))) as 1 | 2 | 3 | 4;
}

/**
 * GitHub-style contribution heatmap — CSS grid of day cells, NOT a Recharts chart. Each day's
 * total activity buckets into 5 levels colored by the sequential blue ramp (magnitude, so a
 * ramp — never the categorical slots). Every cell carries a native title tooltip and the
 * component ships an sr-only summary, but color-on-a-ramp is never the only channel: the page
 * embedding this must provide a table twin (e.g. via `ChartCard`'s `tableView`).
 */
function ActivityHeatmap({ data, weeks = 13, className }: ActivityHeatmapProps) {
  const weekCount = Math.max(1, Math.floor(weeks));

  const totalsByDate = new Map<string, number>();
  for (const point of data) {
    const key = point.date.slice(0, 10);
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + totalEvents(point));
  }

  // The grid ends on the Sunday of the most recent week in the data (falling back to today), and
  // spans exactly `weekCount` Mon–Sun columns back from there.
  const lastKey = [...totalsByDate.keys()].reduce<string | null>(
    (max, key) => (max === null || key > max ? key : max),
    null,
  );
  const endDate = lastKey ? parseDateKey(lastKey) : new Date();
  const gridEnd = addDays(endDate, 6 - mondayIndex(endDate));
  const gridStart = addDays(gridEnd, -(weekCount * 7 - 1));

  const dayTotals: number[] = [];
  let maxTotal = 0;
  for (let i = 0; i < weekCount * 7; i += 1) {
    const total = totalsByDate.get(dateKey(addDays(gridStart, i))) ?? 0;
    dayTotals.push(total);
    if (total > maxTotal) maxTotal = total;
  }

  const columns: HeatmapColumn[] = [];
  for (let week = 0; week < weekCount; week += 1) {
    const cells: HeatmapCell[] = [];
    for (let row = 0; row < 7; row += 1) {
      const index = week * 7 + row;
      const date = addDays(gridStart, index);
      const total = dayTotals[index] ?? 0;
      cells.push({ key: dateKey(date), date, total, level: bucketLevel(total, maxTotal) });
    }
    columns.push({ key: cells[0]?.key ?? String(week), cells });
  }

  // A month label sits above the first column of each new month (and the very first column,
  // unless a boundary label lands within the next two columns and would collide with it).
  const monthLabels = columns.map((column, week) => {
    const monday = column.cells[0]?.date;
    if (!monday) return null;
    if (week === 0) {
      const upcoming = columns
        .slice(1, 3)
        .some((near) => near.cells[0] && near.cells[0].date.getMonth() !== monday.getMonth());
      return upcoming ? null : monday.toLocaleDateString('en-US', { month: 'short' });
    }
    const previousMonday = columns[week - 1]?.cells[0]?.date;
    if (previousMonday && monday.getMonth() !== previousMonday.getMonth()) {
      return monday.toLocaleDateString('en-US', { month: 'short' });
    }
    return null;
  });

  const grandTotal = dayTotals.reduce((sum, total) => sum + total, 0);
  const activeDays = dayTotals.filter((total) => total > 0).length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1 pl-8 text-[10px] leading-3 text-muted-foreground">
            {monthLabels.map((label, week) => (
              <div key={columns[week]?.key ?? week} className="relative h-3 w-3">
                {label ? <span className="absolute left-0 top-0 whitespace-nowrap">{label}</span> : null}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <div className="flex w-7 flex-col gap-1 pr-1 text-[10px] leading-3 text-muted-foreground">
              {DAY_LABELS.map((label, row) => (
                <div key={`${label}-${row}`} className="flex h-3 items-center">
                  {label}
                </div>
              ))}
            </div>
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-1">
                {column.cells.map((cell) => (
                  <div
                    key={cell.key}
                    title={`${cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${cell.total} ${cell.total === 1 ? 'activity' : 'activities'}`}
                    className={cn(
                      'size-3 rounded-[3px]',
                      cell.level === 0 && 'border border-border bg-transparent',
                    )}
                    style={cell.level !== 0 ? { backgroundColor: LEVEL_COLOR[cell.level] } : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 pl-8 text-[10px] text-muted-foreground">
        <span className="pr-1">Less</span>
        <span aria-hidden className="size-3 rounded-[3px] border border-border bg-transparent" />
        {([1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            aria-hidden
            className="size-3 rounded-[3px]"
            style={{ backgroundColor: LEVEL_COLOR[level] }}
          />
        ))}
        <span className="pl-1">More</span>
      </div>
      <p className="sr-only">
        Activity heatmap: {grandTotal} {grandTotal === 1 ? 'activity' : 'activities'} across {activeDays}{' '}
        active {activeDays === 1 ? 'day' : 'days'} in the last {weekCount} weeks.
      </p>
    </div>
  );
}

export { ActivityHeatmap };
