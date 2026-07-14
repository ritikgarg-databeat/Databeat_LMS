// Dialog for a TRAINER/SUPER_ADMIN to broadcast an announcement to a group's trainees. Mounted
// from notifications-page.tsx's "New Announcement" button, which is itself only rendered for
// those two roles (see notifications-page.tsx).
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Role } from '@/constants/roles';
import { useGroupsQuery } from '@/features/groups/hooks';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { useCreateAnnouncementMutation } from '../hooks';

const announcementSchema = z.object({
  groupId: z.string().min(1, 'Select a group.'),
  title: z.string().max(150, 'Title must be 150 characters or fewer.').optional(),
  message: z.string().min(1, 'Message is required.').max(2000, 'Message must be 2000 characters or fewer.'),
});
type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Determines which group source populates the picker below — see `GroupSelectField`. */
  role: Role;
}

interface MinimalGroupOption {
  id: string;
  name: string;
  code: string;
}

interface GroupPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

/** Shared trigger/list markup once the caller-specific option source has resolved its list. */
function GroupSelect({
  groups,
  isLoading,
  value,
  onChange,
  disabled,
}: GroupPickerProps & { groups: MinimalGroupOption[]; isLoading: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger id="groupId" aria-label="Group">
        <SelectValue placeholder={isLoading ? 'Loading groups...' : 'Select a group'} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.name} ({group.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * TRAINER case — only groups they're the assigned trainer for (`GET /groups?trainerId=...`),
 * the same authorization the backend enforces in `notifications.service.ts#createAnnouncement`.
 * Deliberately NOT `GET /groups/mine` — that endpoint returns groups the caller is a *member*
 * of (built for a trainee's Q&A group picker), which a trainer essentially never is.
 */
function TrainerGroupSelect(props: GroupPickerProps) {
  const { user } = useAuth();
  const { data, isLoading } = useGroupsQuery({ trainerId: user?.id ?? '', page: 1, pageSize: 100 });
  return <GroupSelect groups={data?.items ?? []} isLoading={isLoading} {...props} />;
}

/** SUPER_ADMIN case — every group in the org, capped at the shared "effectively all" page size. */
function AdminGroupSelect(props: GroupPickerProps) {
  const { data, isLoading } = useGroupsQuery({ page: 1, pageSize: 100 });
  return <GroupSelect groups={data?.items ?? []} isLoading={isLoading} {...props} />;
}

/**
 * Branches on which query populates the picker. Kept as a plain JSX conditional (not a
 * conditional hook call) so each branch's `useQuery` call stays unconditional within its own
 * component, per the rules of hooks.
 */
function GroupSelectField({ role, ...props }: GroupPickerProps & { role: Role }) {
  return role === 'SUPER_ADMIN' ? <AdminGroupSelect {...props} /> : <TrainerGroupSelect {...props} />;
}

function CreateAnnouncementDialog({ open, onOpenChange, role }: CreateAnnouncementDialogProps) {
  const createAnnouncement = useCreateAnnouncementMutation();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { groupId: '', title: '', message: '' },
  });

  const onSubmit = async (values: AnnouncementFormValues) => {
    try {
      const result = await createAnnouncement.mutateAsync({
        groupId: values.groupId,
        title: values.title || undefined,
        message: values.message,
      });
      toast.success(
        result.notifiedCount === 1 ? 'Notified 1 trainee.' : `Notified ${result.notifiedCount} trainees.`,
      );
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
          <DialogDescription>Broadcast a message to every trainee in one of your groups.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="groupId">Group</Label>
            <Controller
              name="groupId"
              control={control}
              render={({ field }) => (
                <GroupSelectField
                  role={role}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.groupId ? <p className="text-sm text-destructive">{errors.groupId.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="Announcement from your trainer"
              disabled={isSubmitting}
              {...register('title')}
            />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={4} disabled={isSubmitting} {...register('message')} />
            {errors.message ? <p className="text-sm text-destructive">{errors.message.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Announcement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateAnnouncementDialog };
