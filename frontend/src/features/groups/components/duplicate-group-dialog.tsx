import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { getErrorMessage } from '@/utils/error';

import { useDuplicateGroupMutation } from '../hooks';
import type { Group } from '../types';

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;

const duplicateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(150, 'Name must be 150 characters or fewer.'),
  code: z
    .string()
    .min(1, 'Code is required.')
    .regex(CODE_PATTERN, 'Code must be 2-40 letters, numbers, underscores, or dashes.'),
});
type DuplicateGroupFormValues = z.infer<typeof duplicateGroupSchema>;

export interface DuplicateGroupDialogProps {
  group: Group | null;
  onOpenChange: (open: boolean) => void;
}

function DuplicateGroupDialog({ group, onOpenChange }: DuplicateGroupDialogProps) {
  const duplicateGroup = useDuplicateGroupMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DuplicateGroupFormValues>({
    resolver: zodResolver(duplicateGroupSchema),
    values: group ? { name: `${group.name} (Copy)`, code: `${group.code}_COPY` } : undefined,
  });

  if (!group) return null;

  const onSubmit = async (values: DuplicateGroupFormValues) => {
    try {
      await duplicateGroup.mutateAsync({
        id: group.id,
        payload: { name: values.name, code: values.code.toUpperCase() },
      });
      toast.success('Group duplicated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate {group.name}</DialogTitle>
          <DialogDescription>
            Creates a copy with the same department, experience level, trainer, description, and capacity —
            but no members.
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="duplicate-name">Name</Label>
            <Input id="duplicate-name" disabled={isSubmitting} {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="duplicate-code">Code</Label>
            <Input id="duplicate-code" disabled={isSubmitting} {...register('code')} />
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DuplicateGroupDialog };
