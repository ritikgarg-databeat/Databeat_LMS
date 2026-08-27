import { ChartLine, Table2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** A plain-table rendering of the same values a chart plots — its accessibility twin. */
export interface ChartCardTableView {
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartCardProps {
  title: string;
  description?: string;
  /** Extra header controls (e.g. a range select) rendered to the right of the title. */
  actions?: ReactNode;
  /**
   * FIRST-load skeleton only — pass the query's `isLoading`, NOT `isFetching`, so background
   * refetches keep the previous chart on screen instead of flashing a skeleton.
   */
  isLoading?: boolean;
  /**
   * The chart's table twin. Every chart placed in a ChartCard should provide one — tooltips
   * enhance, they must never be the only way to read a value. When provided, a chart ⇄ table
   * toggle renders in the header.
   */
  tableView?: ChartCardTableView;
  className?: string;
  children: ReactNode;
}

/**
 * Card wrapper for every chart in the analytics feature: title/description header, optional
 * header actions, first-load skeleton, and the chart ⇄ table accessibility toggle.
 */
function ChartCard({
  title,
  description,
  actions,
  isLoading,
  tableView,
  className,
  children,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const showTable = view === 'table' && tableView !== undefined;

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {tableView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={view === 'table'}
              aria-label={view === 'table' ? 'Show chart view' : 'Show table view'}
              onClick={() => setView((current) => (current === 'chart' ? 'table' : 'chart'))}
            >
              {view === 'table' ? <ChartLine aria-hidden /> : <Table2 aria-hidden />}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : showTable && tableView ? (
          <Table>
            <TableHeader>
              <TableRow>
                {tableView.headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableView.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className={typeof cell === 'number' ? 'tabular-nums' : undefined}
                    >
                      {typeof cell === 'number' ? cell.toLocaleString('en-US') : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export { ChartCard };
