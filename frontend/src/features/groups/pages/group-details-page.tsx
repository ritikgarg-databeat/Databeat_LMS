import { isAxiosError } from 'axios';
import { MoreHorizontal, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import {
  AddMemberDialog,
  AssignTrainerDialog,
  BulkImportDialog,
  ConfirmActionDialog,
  DuplicateGroupDialog,
  EditGroupDialog,
  TransferMemberDialog,
} from '../components';
import { MEMBERS_PAGE_SIZE } from '../constants';
import {
  useActiveDepartmentsOptions,
  useDeleteGroupMutation,
  useGroupMembersQuery,
  useGroupQuery,
  useRemoveGroupMemberMutation,
  useUpdateGroupStatusMutation,
} from '../hooks';
import type { GroupMember, GroupStatus } from '../types';

const PLACEHOLDER_SECTIONS = ['Events', 'Courses & Assessments', 'Progress', 'Activity'];

function GroupDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const groupsBasePath = isAdminRoute ? '/admin/groups' : '/trainer/groups';

  const [memberSearch, setMemberSearch] = useState('');
  const debouncedMemberSearch = useDebounce(memberSearch, 300);
  const [memberPage, setMemberPage] = useState(1);

  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [assignTrainerOpen, setAssignTrainerOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<GroupMember | null>(null);
  const [transferringMember, setTransferringMember] = useState<GroupMember | null>(null);

  const { data: group, isLoading, isError, error, refetch } = useGroupQuery(id);
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: members, isLoading: isLoadingMembers } = useGroupMembersQuery(id, {
    page: memberPage,
    pageSize: MEMBERS_PAGE_SIZE,
    search: debouncedMemberSearch || undefined,
    sortBy: 'joinedAt',
    sortOrder: 'desc',
  });

  const updateStatus = useUpdateGroupStatusMutation();
  const deleteGroup = useDeleteGroupMutation();
  const removeMember = useRemoveGroupMemberMutation();

  const departmentName = (departmentId: string | null) =>
    departments?.find((department) => department.id === departmentId)?.name ?? '—';

  if (!id) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 403) {
      return (
        <ErrorScreen title="Access denied" message="You do not have access to this group." />
      );
    }
    if (httpStatus === 404) {
      return <ErrorScreen title="Group not found" message="This group may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load this group." onRetry={() => void refetch()} />;
  }

  if (isLoading || !group) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 animate-none animate-shimmer" />
        <Skeleton className="h-48 w-full animate-none animate-shimmer" />
        <Skeleton className="h-64 w-full animate-none animate-shimmer" />
      </div>
    );
  }

  const handleUpdateStatus = async () => {
    const nextStatus: GroupStatus = group.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    try {
      await updateStatus.mutateAsync({ id: group.id, payload: { status: nextStatus } });
      // The mutation's own cache invalidation is fire-and-forget (not awaited), so it can
      // resolve after this dialog has already closed and re-rendered with stale data —
      // await an explicit refetch here so the badge is guaranteed current before we proceed.
      await refetch();
      toast.success(`${group.name} ${nextStatus === 'ARCHIVED' ? 'archived' : 'restored'}.`);
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    } finally {
      setStatusConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGroup.mutateAsync(group.id);
      toast.success(`${group.name} deleted.`);
      navigate(groupsBasePath);
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
      setDeleteConfirmOpen(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      await removeMember.mutateAsync({ groupId: group.id, userId: removingMember.userId });
      toast.success(`${removingMember.user.firstName} ${removingMember.user.lastName} removed.`);
    } catch (removeError) {
      toast.error(getErrorMessage(removeError));
    } finally {
      setRemovingMember(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            <Badge variant={group.status === 'ACTIVE' ? 'success' : 'secondary'}>
              {group.status === 'ACTIVE' ? 'Active' : 'Archived'}
            </Badge>
          </div>
          <p className="text-muted-foreground">{group.code}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAssignTrainerOpen(true)}>Assign Trainer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusConfirmOpen(true)}>
              {group.status === 'ACTIVE' ? 'Archive' : 'Restore'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Department</p>
            <p className="text-sm">{group.department.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Experience level</p>
            <p className="text-sm">{group.experienceLevel?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Trainer</p>
            <p className="text-sm">
              {group.trainer ? `${group.trainer.firstName} ${group.trainer.lastName}` : 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Start date</p>
            <p className="text-sm">{group.startDate ? formatDate(group.startDate) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">End date</p>
            <p className="text-sm">{group.endDate ? formatDate(group.endDate) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Members</p>
            <p className="text-sm">
              {group.capacity ? `${group._count.members} / ${group.capacity}` : group._count.members}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
            <p className="text-sm">{group.description || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              <Upload />
              Bulk Import CSV
            </Button>
            <Button onClick={() => setAddMembersOpen(true)}>
              <Plus />
              Add Members
            </Button>
          </div>
        </div>

        <SearchBox
          value={memberSearch}
          onChange={(value) => {
            setMemberSearch(value);
            setMemberPage(1);
          }}
          placeholder="Search members..."
          containerClassName="w-64"
        />

        {isLoadingMembers ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !members?.items.length ? (
          <EmptyState title="No members yet" description="Add trainees to this group to get started." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user.firstName} {member.user.lastName}
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>{departmentName(member.user.departmentId)}</TableCell>
                    <TableCell>
                      <Badge variant={member.user.isActive ? 'success' : 'secondary'}>
                        {member.user.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.joinedAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${member.user.firstName} ${member.user.lastName}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setTransferringMember(member)}>
                            Transfer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRemovingMember(member)}
                          >
                            Remove
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
                    aria-disabled={memberPage <= 1}
                    className={memberPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {members.meta.page} of {Math.max(1, Math.ceil(members.meta.total / members.meta.pageSize))}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    aria-disabled={memberPage * MEMBERS_PAGE_SIZE >= members.meta.total}
                    className={
                      memberPage * MEMBERS_PAGE_SIZE >= members.meta.total
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                    onClick={() => setMemberPage((p) => p + 1)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_SECTIONS.map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming soon.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditGroupDialog group={editOpen ? group : null} onOpenChange={setEditOpen} />

      <DuplicateGroupDialog group={duplicateOpen ? group : null} onOpenChange={setDuplicateOpen} />

      <AssignTrainerDialog group={assignTrainerOpen ? group : null} onOpenChange={setAssignTrainerOpen} />

      <AddMemberDialog groupId={group.id} open={addMembersOpen} onOpenChange={setAddMembersOpen} />

      <BulkImportDialog groupId={group.id} open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

      <TransferMemberDialog
        groupId={group.id}
        member={transferringMember}
        onOpenChange={(open) => !open && setTransferringMember(null)}
      />

      <ConfirmActionDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        title={group.status === 'ACTIVE' ? 'Archive group' : 'Restore group'}
        description={
          group.status === 'ACTIVE'
            ? `${group.name} will be archived and hidden from active lists.`
            : `${group.name} will be restored to active status.`
        }
        confirmLabel={group.status === 'ACTIVE' ? 'Archive' : 'Restore'}
        destructive={group.status === 'ACTIVE'}
        onConfirm={() => void handleUpdateStatus()}
      />

      <ConfirmActionDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete group"
        description={`${group.name} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />

      <ConfirmActionDialog
        open={removingMember !== null}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remove member"
        description={
          removingMember
            ? `${removingMember.user.firstName} ${removingMember.user.lastName} will be removed from this group.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => void handleRemoveMember()}
      />
    </div>
  );
}

export { GroupDetailsPage };
