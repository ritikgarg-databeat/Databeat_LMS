import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState, ErrorScreen, SearchBox } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { Role } from '@/constants/roles';
import type { AuthUser } from '@/features/auth/types';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { CreateUserDialog, EditUserDialog } from '../components';
import { STATUS_OPTIONS, USERS_PAGE_SIZE } from '../constants';
import {
  useDeactivateUserMutation,
  useDepartmentsQuery,
  useExperienceLevelsQuery,
  useReactivateUserMutation,
  useResetPasswordMutation,
  useUsersQuery,
} from '../hooks';
import type { SortField, SortOrder } from '../types';

export interface UsersListPageProps {
  /** Which role this instance manages — TRAINER (Super Admin view) or TRAINEE (Trainer view). */
  manageRole: Extract<Role, 'TRAINER' | 'TRAINEE'>;
}

/**
 * Single implementation reused for both "Trainer manages Trainees" and "Super Admin manages
 * Trainers" (USER MANAGEMENT spec) — the only difference is which role is targeted and
 * whether the Experience Level filter/column applies (trainee-only field).
 */
function UsersListPage({ manageRole }: UsersListPageProps) {
  const isTraineeView = manageRole === 'TRAINEE';
  const label = isTraineeView ? 'Trainee' : 'Trainer';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [departmentId, setDepartmentId] = useState('');
  const [experienceLevelId, setExperienceLevelId] = useState('');
  const [isActive, setIsActive] = useState('');
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
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [pendingToggle, setPendingToggle] = useState<AuthUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const { data: departments } = useDepartmentsQuery();
  const { data: experienceLevels } = useExperienceLevelsQuery();
  const { data, isLoading, isError, refetch } = useUsersQuery({
    role: manageRole,
    page,
    pageSize: USERS_PAGE_SIZE,
    search: debouncedSearch || undefined,
    departmentId: departmentId || undefined,
    experienceLevelId: isTraineeView && experienceLevelId ? experienceLevelId : undefined,
    isActive: isActive ? isActive === 'true' : undefined,
    sortBy,
    sortOrder,
  });

  const deactivateUser = useDeactivateUserMutation();
  const reactivateUser = useReactivateUserMutation();
  const resetPassword = useResetPasswordMutation();

  const departmentName = (id: string | null) => departments?.find((d) => d.id === id)?.name ?? '—';
  const experienceLevelName = (id: string | null) => experienceLevels?.find((l) => l.id === id)?.name ?? '—';

  const handleToggleActive = async () => {
    if (!pendingToggle) return;
    try {
      if (pendingToggle.isActive) {
        await deactivateUser.mutateAsync(pendingToggle.id);
        toast.success(`${pendingToggle.fullName} deactivated.`);
      } else {
        await reactivateUser.mutateAsync(pendingToggle.id);
        toast.success(`${pendingToggle.fullName} reactivated.`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingToggle(null);
    }
  };

  const handleResetPassword = async (user: AuthUser) => {
    try {
      const result = await resetPassword.mutateAsync({ id: user.id, payload: {} });
      setTemporaryPassword(result.temporaryPassword ?? null);
      if (!result.temporaryPassword) toast.success('Password reset successfully.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (isError) {
    return <ErrorScreen message={`Failed to load ${label.toLowerCase()}s.`} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{label}s</h1>
          <p className="text-muted-foreground">Manage {label.toLowerCase()} accounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create {label}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={`Search ${label.toLowerCase()}s...`}
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

        {isTraineeView ? (
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
        ) : null}

        <Select
          value={isActive || 'all'}
          onValueChange={(value) => {
            setIsActive(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-auto min-w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
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
        <EmptyState title={`No ${label.toLowerCase()}s found`} description="Try adjusting your filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('firstName')}
                  >
                    Name {sortIcon('firstName')}
                  </button>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                {isTraineeView ? <TableHead>Experience</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('lastLogin')}
                  >
                    Last login {sortIcon('lastLogin')}
                  </button>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{departmentName(user.departmentId)}</TableCell>
                  {isTraineeView ? <TableCell>{experienceLevelName(user.experienceLevelId)}</TableCell> : null}
                  <TableCell>
                    <Badge variant={user.isActive ? 'success' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.fullName}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleResetPassword(user)}>
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPendingToggle(user)}>
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
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
                  aria-disabled={page * USERS_PAGE_SIZE >= data.meta.total}
                  className={
                    page * USERS_PAGE_SIZE >= data.meta.total ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} manageRole={manageRole} />

      <EditUserDialog
        user={editingUser}
        showExperienceLevel={isTraineeView}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />

      <Dialog open={pendingToggle !== null} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingToggle?.isActive ? 'Deactivate' : 'Reactivate'} user</DialogTitle>
            <DialogDescription>
              {pendingToggle?.isActive
                ? `${pendingToggle.fullName} will no longer be able to sign in.`
                : `${pendingToggle?.fullName} will regain access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={pendingToggle?.isActive ? 'destructive' : 'default'}
              onClick={() => void handleToggleActive()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={temporaryPassword !== null} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password generated</DialogTitle>
            <DialogDescription>
              Share this password securely — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <code className="block rounded-md bg-muted p-3 text-center text-lg font-semibold tracking-wider">
            {temporaryPassword}
          </code>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { UsersListPage };
