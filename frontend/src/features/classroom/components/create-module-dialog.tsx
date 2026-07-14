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

import { useCreateModuleMutation } from '../hooks';

const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.').optional(),
  // Kept as a raw string (matching the native <input type="number"> value) and converted to a
  // number only at submit time — same convention as create-group-dialog.tsx's `capacity` field.
  estimatedDurationMinutes: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Estimated duration must be a positive whole number.'),
});
type CreateModuleFormValues = z.infer<typeof createModuleSchema>;

export interface CreateModuleDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateModuleDialog({ courseId, open, onOpenChange }: CreateModuleDialogProps) {
  const createModule = useCreateModuleMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateModuleFormValues>({ resolver: zodResolver(createModuleSchema) });

  const onSubmit = async (values: CreateModuleFormValues) => {
    try {
      await createModule.mutateAsync({
        courseId,
        title: values.title,
        description: values.description || undefined,
        estimatedDurationMinutes: values.estimatedDurationMinutes ? Number(values.estimatedDurationMinutes) : undefined,
      });
      toast.success('Module created successfully.');
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Module</DialogTitle>
          <DialogDescription>Create a new module in this course.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="module-title">Title</Label>
            <Input id="module-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea id="module-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-estimatedDurationMinutes">Estimated duration (minutes)</Label>
            <Input
              id="module-estimatedDurationMinutes"
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
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateModuleDialog };
