import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';

import { EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDateTime } from '@/utils/date';

import { useAuditLogsQuery } from '../hooks';
import { AUDIT_ACTIONS, formatAuditAction, type AuditAction } from '../types';

const PAGE_SIZE = 20;

/** Super Admin-only, org-wide browser over the AuditLog model — see backend/src/modules/audit-log/README.md. */
function AuditLogPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [action, setAction] = useState('');
  const [createdAtFrom, setCreatedAtFrom] = useState('');
  const [createdAtTo, setCreatedAtTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAuditLogsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    action: (action || undefined) as AuditAction | undefined,
    createdAtFrom: createdAtFrom || undefined,
    createdAtTo: createdAtTo || undefined,
  });

  if (isError) {
    return <ErrorScreen message="Failed to load the audit log." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">Every security-relevant action recorded across the platform.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by actor or target name/email..."
          containerClassName="w-72"
        />

        <Select
          value={action || 'all'}
          onValueChange={(value) => {
            setAction(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-48" aria-label="Filter by action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all">All actions</SelectItem>
            {AUDIT_ACTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {formatAuditAction(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-1">
          <Label htmlFor="createdAtFrom" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="createdAtFrom"
            type="date"
            className="w-40"
            value={createdAtFrom}
            onChange={(event) => {
              setCreatedAtFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="createdAtTo" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="createdAtTo"
            type="date"
            className="w-40"
            value={createdAtTo}
            onChange={(event) => {
              setCreatedAtTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="No audit log entries found" description="Try adjusting your filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const hasMetadata = entry.metadata !== null && entry.metadata !== undefined;
                return (
                  <Fragment key={entry.id}>
                    <TableRow
                      className={hasMetadata ? 'cursor-pointer' : undefined}
                      onClick={() => hasMetadata && setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <TableCell>
                        {hasMetadata ? (
                          isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Badge variant="secondary">{formatAuditAction(entry.action)}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : '—'}
                      </TableCell>
                      <TableCell>
                        {entry.targetUser
                          ? `${entry.targetUser.firstName} ${entry.targetUser.lastName}`
                          : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.ipAddress ?? '—'}
                      </TableCell>
                      <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow key={`${entry.id}-metadata`}>
                        <TableCell colSpan={6} className="bg-muted/40">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground">
                  Page {data.meta.page} of {Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={page * PAGE_SIZE >= data.meta.total}
                  className={
                    page * PAGE_SIZE >= data.meta.total ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
}

export { AuditLogPage };
