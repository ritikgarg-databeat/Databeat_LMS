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
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useUpdateModuleMutation } from '../hooks';
import type { CourseModule } from '../types';

const editModuleSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.').optional(),
  estimatedDurationMinutes: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^[1-9]\d*$/.test(value),
      'Estimated duration must be a positive whole number.',
    ),
});
type EditModuleFormValues = z.infer<typeof editModuleSchema>;

export interface EditModuleDialogProps {
  module: CourseModule | null;
  onOpenChange: (open: boolean) => void;
}

function EditModuleDialog({ module, onOpenChange }: EditModuleDialogProps) {
  const updateModule = useUpdateModuleMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditModuleFormValues>({
    resolver: zodResolver(editModuleSchema),
    values: module
      ? {
          title: module.title,
          description: module.description ?? '',
          estimatedDurationMinutes:
            module.estimatedDurationMinutes !== null ? String(module.estimatedDurationMinutes) : '',
        }
      : undefined,
  });

  if (!module) return null;

  const onSubmit = async (values: EditModuleFormValues) => {
    try {
      await updateModule.mutateAsync({
        id: module.id,
        payload: {
          title: values.title,
          description: values.description || null,
          estimatedDurationMinutes: values.estimatedDurationMinutes
            ? Number(values.estimatedDurationMinutes)
            : null,
        },
      });
      toast.success('Module updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {module.title}</DialogTitle>
          <DialogDescription>Update the module&apos;s details.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-module-title">Title</Label>
            <Input id="edit-module-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-module-description">Description</Label>
            <Textarea
              id="edit-module-description"
              rows={3}
              disabled={isSubmitting}
              {...register('description')}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-module-estimatedDurationMinutes">Estimated duration (minutes)</Label>
            <Input
              id="edit-module-estimatedDurationMinutes"
              type="number"
              min={1}
              disabled={isSubmitting}
              {...register('estimatedDurationMinutes')}
            />
            {errors.estimatedDurationMinutes ? (
              <p className="text-sm text-destructive">{errors.estimatedDurationMinutes.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { EditModuleDialog };
