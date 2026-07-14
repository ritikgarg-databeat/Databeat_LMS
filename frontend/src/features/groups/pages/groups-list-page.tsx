import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { getErrorMessage } from '@/utils/error';

import {
  AssignTrainerDialog,
  ConfirmActionDialog,
  CreateGroupDialog,
  DuplicateGroupDialog,
  EditGroupDialog,
} from '../components';
import { GROUPS_PAGE_SIZE, STATUS_OPTIONS } from '../constants';
import {
  useActiveDepartmentsOptions,
  useActiveExperienceLevelsOptions,
  useDeleteGroupMutation,
  useGroupsQuery,
  useUpdateGroupStatusMutation,
} from '../hooks';
import type { Group, GroupStatus, SortField, SortOrder } from '../types';

function GroupsListPage() {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const groupsBasePath = isAdminRoute ? '/admin/groups' : '/trainer/groups';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [departmentId, setDepartmentId] = useState('');
  const [experienceLevelId, setExperienceLevelId] = useState('');
  const [status, setStatus] = useState<'' | GroupStatus>('');
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
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [duplicatingGroup, setDuplicatingGroup] = useState<Group | null>(null);
  const [assigningTrainerGroup, setAssigningTrainerGroup] = useState<Group | null>(null);
  const [statusTarget, setStatusTarget] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  const { data: departments } = useActiveDepartmentsOptions();
  const { data: experienceLevels } = useActiveExperienceLevelsOptions();
  const { data, isLoading, isError, refetch } = useGroupsQuery({
    page,
    pageSize: GROUPS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    departmentId: departmentId || undefined,
    experienceLevelId: experienceLevelId || undefined,
    status: status || undefined,
    sortBy,
    sortOrder,
  });

  const updateStatus = useUpdateGroupStatusMutation();
  const deleteGroup = useDeleteGroupMutation();

  const handleUpdateStatus = async () => {
    if (!statusTarget) return;
    const nextStatus: GroupStatus = statusTarget.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await updateStatus.mutateAsync({ id: statusTarget.id, payload: { status: nextStatus } });
      toast.success(`${statusTarget.name} ${nextStatus === 'ARCHIVED' ? 'archived' : 'restored'}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setStatusTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    try {
      await deleteGroup.mutateAsync(deletingGroup.id);
      toast.success(`${deletingGroup.name} deleted.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingGroup(null);
    }
  };

  if (isError) {
    return <ErrorScreen message="Failed to load groups." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-muted-foreground">Manage training batches.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Group
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search groups..."
          containerClassName="w-64"
        />

        <Select
          value={departmentId || 'all'}
          onValueChange={(value) => {
            setDepartmentId(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments?.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={experienceLevelId || 'all'}
          onValueChange={(value) => {
            setExperienceLevelId(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by experience level">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {experienceLevels?.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {level.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus((value === 'all' ? '' : value) as '' | GroupStatus);
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
            <Skeleton key={i} className="h-12 w-full animate-none animate-shimmer" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="No groups found" description="Try adjusting your filters." />
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
                <TableHead>Department</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    <Link to={`${groupsBasePath}/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </TableCell>
                  <TableCell>{group.code}</TableCell>
                  <TableCell>{group.department.name}</TableCell>
                  <TableCell>
                    {group.trainer ? `${group.trainer.firstName} ${group.trainer.lastName}` : 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    {group.capacity ? `${group._count.members} / ${group.capacity}` : group._count.members}
                  </TableCell>
                  <TableCell>
                    <Badge variant={group.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {group.status === 'ACTIVE' ? 'Active' : 'Archived'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${group.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`${groupsBasePath}/${group.id}`}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingGroup(group)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDuplicatingGroup(group)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAssigningTrainerGroup(group)}>
                          Assign Trainer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatusTarget(group)}>
                          {group.status === 'ACTIVE' ? 'Archive' : 'Restore'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingGroup(group)}
                        >
                          Delete
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
                  aria-disabled={page * GROUPS_PAGE_SIZE >= data.meta.total}
                  className={
                    page * GROUPS_PAGE_SIZE >= data.meta.total
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

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditGroupDialog group={editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)} />

      <DuplicateGroupDialog
        group={duplicatingGroup}
        onOpenChange={(open) => !open && setDuplicatingGroup(null)}
      />

      <AssignTrainerDialog
        group={assigningTrainerGroup}
        onOpenChange={(open) => !open && setAssigningTrainerGroup(null)}
      />

      <ConfirmActionDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? 'Archive group' : 'Restore group'}
        description={
          statusTarget?.status === 'ACTIVE'
            ? `${statusTarget?.name} will be archived and hidden from active lists.`
            : `${statusTarget?.name} will be restored to active status.`
        }
        confirmLabel={statusTarget?.status === 'ACTIVE' ? 'Archive' : 'Restore'}
        destructive={statusTarget?.status === 'ACTIVE'}
        onConfirm={() => void handleUpdateStatus()}
      />

      <ConfirmActionDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        title="Delete group"
        description={`${deletingGroup?.name} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { GroupsListPage };
