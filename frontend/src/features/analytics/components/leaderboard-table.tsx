// Shared leaderboard table — used by the trainer dashboard leaderboard card and any drill-down
// page that wants to render a `LeaderboardEntry[]` (group/user analytics do NOT use this: their
// member/attempt rows have a different shape entirely).
import { Medal, Trophy } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { LeaderboardEntry } from '../types';

import { formatNumber, formatPercent } from './format';
import { ProgressMeter } from './progress-meter';

export interface LeaderboardTableProps {
  items: LeaderboardEntry[];
  /** The row for this user id gets a subtle accent background (e.g. "you" on the trainee view). */
  highlightUserId?: string;
  /** When true, the name column links to `/trainer/users/:id/analytics`. */
  linkToUserAnalytics?: boolean;
  className?: string;
}

const MAX_VISIBLE_GROUPS = 2;

const RANK_ACCENT: Record<number, { icon: ComponentType<{ className?: string }>; className: string }> = {
  1: { icon: Trophy, className: 'text-warning' },
  2: { icon: Medal, className: 'text-muted-foreground' },
  3: { icon: Medal, className: 'text-warning/70' },
};

/**
 * Rank 1-3 wear a medal icon — this is a UI accent for standing, not a data-encoding series, so
 * the fixed viz-slot contract doesn't apply. Ranks 4+ render as a plain "#N".
 */
function RankCell({ rank }: { rank: number }) {
  const accent = RANK_ACCENT[rank];
  if (!accent) {
    return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>;
  }
  const Icon = accent.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', accent.className)}>
      <Icon className="size-4" aria-hidden />
      {rank}
    </span>
  );
}

function GroupBadges({ groupNames }: { groupNames: string[] }) {
  if (groupNames.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  const visible = groupNames.slice(0, MAX_VISIBLE_GROUPS);
  const remaining = groupNames.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((name) => (
        <Badge key={name} variant="secondary" className="max-w-32 truncate">
          {name}
        </Badge>
      ))}
      {remaining > 0 ? <Badge variant="outline">+{remaining}</Badge> : null}
    </div>
  );
}

/**
 * Rank / Name / Groups / Completion / Avg Score / Activity / Performance leaderboard table.
 * Embed inside a `Card` or `ChartCard`-less section at the call site — this component owns only
 * the table itself (and its empty state) so it composes into the trainer dashboard, a group
 * page's "top performers" panel, etc.
 */
function LeaderboardTable({ items, highlightUserId, linkToUserAnalytics, className }: LeaderboardTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No leaderboard data yet"
        description="Rankings appear once trainees start completing lessons and assessments."
      />
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Groups</TableHead>
          <TableHead>Completion</TableHead>
          <TableHead>Avg Score</TableHead>
          <TableHead>Activity (7d)</TableHead>
          <TableHead className="text-right">Performance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.userId} className={cn(item.userId === highlightUserId && 'bg-accent/60')}>
            <TableCell>
              <RankCell rank={item.rank} />
            </TableCell>
            <TableCell className="font-medium">
              {linkToUserAnalytics ? (
                <Link to={`/trainer/users/${item.userId}/analytics`} className="hover:underline">
                  {item.name}
                </Link>
              ) : (
                item.name
              )}
            </TableCell>
            <TableCell>
              <GroupBadges groupNames={item.groupNames} />
            </TableCell>
            <TableCell>
              <ProgressMeter value={item.completionPercentage} className="w-32" />
            </TableCell>
            <TableCell className="tabular-nums">
              {item.averageScore === null ? '—' : formatPercent(item.averageScore)}
            </TableCell>
            <TableCell className="tabular-nums">{formatNumber(item.activityEvents7d)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatNumber(item.performanceScore)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { LeaderboardTable };
