import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SearchBox } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/utils/error';

import { useAddGroupMembersMutation, useGroupMembersQuery, useTraineesOptions } from '../hooks';

export interface AddMemberDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Assign Users" dialog — a searchable checklist of Trainees not already in this group,
 * submitted in one call via the bulk `POST /members/bulk` endpoint.
 *
 * The exclusion set is fetched here rather than threaded down as a prop, so it always reflects
 * the group's *entire* current roster rather than whichever page happens to be visible behind
 * the dialog. Like the other feature-local lookups, it's capped at the backend's page-size
 * ceiling (100) — see services/index.ts.
 */
function AddMemberDialog({ groupId, open, onOpenChange }: AddMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: trainees, isLoading: isLoadingTrainees } = useTraineesOptions();
  const { data: currentMembers, isLoading: isLoadingMembers } = useGroupMembersQuery(
    open ? groupId : undefined,
    {
      page: 1,
      pageSize: 100,
    },
  );
  const addMembers = useAddGroupMembersMutation();

  const existingIds = useMemo(
    () => new Set(currentMembers?.items.map((member) => member.userId) ?? []),
    [currentMembers],
  );

  const availableTrainees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (trainees ?? []).filter((trainee) => {
      if (existingIds.has(trainee.id)) return false;
      if (!query) return true;
      return trainee.fullName.toLowerCase().includes(query) || trainee.email.toLowerCase().includes(query);
    });
  }, [trainees, existingIds, search]);

  const toggle = (id: string) => {
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id],
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      setSelected([]);
    }
    onOpenChange(next);
  };

  const onSubmit = async () => {
    if (selected.length === 0) return;
    try {
      const result = await addMembers.mutateAsync({ groupId, payload: { userIds: selected } });
      toast.success(
        `${result.added} member${result.added === 1 ? '' : 's'} added${result.skipped ? `, ${result.skipped} skipped` : ''}.`,
      );
      handleOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const isLoading = isLoadingTrainees || isLoadingMembers;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Users</DialogTitle>
          <DialogDescription>Select trainees to add to this group.</DialogDescription>
        </DialogHeader>

        <SearchBox value={search} onChange={setSearch} placeholder="Search trainees..." />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">Loading trainees...</p>
          ) : availableTrainees.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No trainees available to add.</p>
          ) : (
            availableTrainees.map((trainee) => (
              <label
                key={trainee.id}
                htmlFor={`trainee-${trainee.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  id={`trainee-${trainee.id}`}
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={selected.includes(trainee.id)}
                  onChange={() => toggle(trainee.id)}
                />
                <span className="flex-1 font-medium">
                  {trainee.fullName}
                  <span className="block text-xs font-normal text-muted-foreground">{trainee.email}</span>
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={selected.length === 0 || addMembers.isPending}
            onClick={() => void onSubmit()}
          >
            {addMembers.isPending ? 'Adding...' : selected.length ? `Add ${selected.length} selected` : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AddMemberDialog };
