import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPercent } from '@/features/analytics/components';
import type { LeaderboardEntry } from '@/features/analytics/types';
import { cn } from '@/lib/utils';

export interface TrainerLeaderboardCardProps {
  entries: LeaderboardEntry[] | undefined;
  isLoading: boolean;
}

const TROPHY_ACCENT: Record<number, string> = {
  1: 'text-warning',
  2: 'text-muted-foreground',
  3: 'text-muted-foreground',
};

/** Trainer dashboard "Top performers" leaderboard (Prompt 8) — compact ranked table. */
function TrainerLeaderboardCard({ entries, isLoading }: TrainerLeaderboardCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top performers</CardTitle>
        <CardDescription>Full leaderboard filters are on group analytics pages.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !entries || entries.length === 0 ? (
          <EmptyState icon={Trophy} title="No performance data yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Avg score</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                      {entry.rank <= 3 ? (
                        <Trophy className={cn('size-4', TROPHY_ACCENT[entry.rank])} aria-hidden />
                      ) : null}
                      {entry.rank}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/trainer/users/${entry.userId}/analytics`} className="hover:underline">
                      {entry.name}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatPercent(entry.completionPercentage)}</TableCell>
                  <TableCell className="tabular-nums">
                    {entry.averageScore !== null ? formatPercent(entry.averageScore) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{Math.round(entry.performanceScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { TrainerLeaderboardCard };
