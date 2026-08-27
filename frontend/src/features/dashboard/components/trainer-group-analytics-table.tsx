import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { formatPercent, ProgressMeter } from '@/features/analytics/components';
import type { GroupAnalyticsRow } from '@/features/analytics/types';
import { formatRelativeTime } from '@/utils/date';

export interface TrainerGroupAnalyticsTableProps {
  groups: GroupAnalyticsRow[] | undefined;
  isLoading: boolean;
  basePath?: string;
}

/** Trainer dashboard "Group Analytics" section (Prompt 8) — rollup row per assigned group. */
function TrainerGroupAnalyticsTable({
  groups,
  isLoading,
  basePath = ROUTES.TRAINER.ROOT,
}: TrainerGroupAnalyticsTableProps) {
  const groupsPath = `${basePath}/groups`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Group Analytics</CardTitle>
        <Link to={groupsPath} className="text-sm text-primary hover:underline">
          All groups →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !groups || groups.length === 0 ? (
          <EmptyState icon={Users} title="No groups assigned to you yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Trainees</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Avg score</TableHead>
                <TableHead>Active 7d</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.groupId}>
                  <TableCell className="font-medium">
                    <Link to={`${groupsPath}/${group.groupId}/analytics`} className="hover:underline">
                      {group.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{group.code}</TableCell>
                  <TableCell className="tabular-nums">{group.traineeCount}</TableCell>
                  <TableCell className="min-w-32">
                    <ProgressMeter value={group.completionPercentage} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {group.averageScore !== null ? formatPercent(group.averageScore) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{group.activeUsers7d}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.lastActivityAt ? formatRelativeTime(group.lastActivityAt) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { TrainerGroupAnalyticsTable };
