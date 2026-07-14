import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/utils/error';

import { useGroupsQuery, useTransferGroupMemberMutation } from '../hooks';
import type { GroupMember } from '../types';

const transferMemberSchema = z.object({ toGroupId: z.string().min(1, 'Choose a destination group.') });
type TransferMemberFormValues = z.infer<typeof transferMemberSchema>;

export interface TransferMemberDialogProps {
  groupId: string;
  member: GroupMember | null;
  onOpenChange: (open: boolean) => void;
}

/** Small mini-dialog opened from a member row's "Transfer" action — moves them to another ACTIVE group. */
function TransferMemberDialog({ groupId, member, onOpenChange }: TransferMemberDialogProps) {
  const transferMember = useTransferGroupMemberMutation();
  const { data: groups } = useGroupsQuery({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const otherGroups = groups?.items.filter((group) => group.id !== groupId) ?? [];

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferMemberFormValues>({
    resolver: zodResolver(transferMemberSchema),
    defaultValues: { toGroupId: '' },
  });

  if (!member) return null;

  const onSubmit = async (values: TransferMemberFormValues) => {
    try {
      await transferMember.mutateAsync({
        groupId,
        userId: member.userId,
        payload: { toGroupId: values.toGroupId },
      });
      toast.success(`${member.user.firstName} ${member.user.lastName} transferred successfully.`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer member</DialogTitle>
          <DialogDescription>
            Move {member.user.firstName} {member.user.lastName} to a different group.
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="toGroupId">Destination group</Label>
            <Controller
              name="toGroupId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id="toGroupId">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.toGroupId ? <p className="text-sm text-destructive">{errors.toGroupId.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Transferring...' : 'Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { TransferMemberDialog };
