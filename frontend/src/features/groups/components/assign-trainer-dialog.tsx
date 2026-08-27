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

import { useAssignTrainerMutation, useTrainersOptions } from '../hooks';
import type { Group } from '../types';

const assignTrainerSchema = z.object({ trainerId: z.string().optional() });
type AssignTrainerFormValues = z.infer<typeof assignTrainerSchema>;

export interface AssignTrainerDialogProps {
  group: Group | null;
  onOpenChange: (open: boolean) => void;
}

function AssignTrainerDialog({ group, onOpenChange }: AssignTrainerDialogProps) {
  const assignTrainer = useAssignTrainerMutation();
  const { data: trainers } = useTrainersOptions(Boolean(group));

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AssignTrainerFormValues>({
    resolver: zodResolver(assignTrainerSchema),
    values: group ? { trainerId: group.trainerId ?? '' } : undefined,
  });

  if (!group) return null;

  const onSubmit = async (values: AssignTrainerFormValues) => {
    try {
      await assignTrainer.mutateAsync({ id: group.id, payload: { trainerId: values.trainerId || null } });
      toast.success(values.trainerId ? 'Trainer assigned successfully.' : 'Trainer unassigned successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Trainer</DialogTitle>
          <DialogDescription>Choose a trainer for {group.name}, or clear to unassign.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="assign-trainerId">Trainer</Label>
            <Controller
              name="trainerId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="assign-trainerId">
                    <SelectValue placeholder="Select a trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {trainers?.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id}>
                        {trainer.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AssignTrainerDialog };
