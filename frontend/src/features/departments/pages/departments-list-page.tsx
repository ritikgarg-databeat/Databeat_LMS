import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { CreateDepartmentDialog, EditDepartmentDialog } from '../components';
import { DEPARTMENTS_PAGE_SIZE, STATUS_OPTIONS } from '../constants';
import { useDepartmentsQuery, useUpdateDepartmentStatusMutation } from '../hooks';
import type { Department, DepartmentStatus, SortField, SortOrder } from '../types';

function DepartmentsListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<'' | DepartmentStatus>('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const sortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const { data, isLoading, isError, refetch } = useDepartmentsQuery({
    page,
    pageSize: DEPARTMENTS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    sortBy,
    sortOrder,
  });

  const updateStatus = useUpdateDepartmentStatusMutation();

  const handleToggleStatus = async (department: Department) => {
    const nextStatus: DepartmentStatus = department.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateStatus.mutateAsync({ id: department.id, payload: { status: nextStatus } });
      toast.success(`${department.name} ${nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (isError) {
    return <ErrorScreen message="Failed to load departments." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">Manage organizational departments.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Department
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search departments..."
          containerClassName="w-64"
        />

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus((value === 'all' ? '' : value) as '' | DepartmentStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || 'all'}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="No departments found" description="Try adjusting your filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('name')}
                  >
                    Name {sortIcon('name')}
                  </button>
                </TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('createdAt')}
                  >
                    Created {sortIcon('createdAt')}
                  </button>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell>{department.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{department.description ?? '—'}</TableCell>
                  <TableCell>{department._count.users}</TableCell>
                  <TableCell>{department._count.groups}</TableCell>
                  <TableCell>
                    <Badge variant={department.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {department.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(department.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${department.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingDepartment(department)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleToggleStatus(department)}>
                          {department.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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
                  aria-disabled={page * DEPARTMENTS_PAGE_SIZE >= data.meta.total}
                  className={
                    page * DEPARTMENTS_PAGE_SIZE >= data.meta.total
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}

      <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditDepartmentDialog
        department={editingDepartment}
        onOpenChange={(open) => !open && setEditingDepartment(null)}
      />
    </div>
  );
}

export { DepartmentsListPage };
