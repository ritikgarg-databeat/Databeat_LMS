import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useUpdateDepartmentMutation } from '../hooks';
import type { Department } from '../types';

// Case-insensitive here — the value is uppercased on submit before being sent to the API,
// which itself only accepts the uppercase form (see backend departments.validation.ts).
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,30}$/;

const editDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(80, 'Name must be 80 characters or fewer.'),
  code: z
    .string()
    .min(1, 'Code is required.')
    .regex(CODE_PATTERN, 'Code must be 2-30 letters, numbers, underscores, or dashes.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
});
type EditDepartmentFormValues = z.infer<typeof editDepartmentSchema>;

export interface EditDepartmentDialogProps {
  department: Department | null;
  onOpenChange: (open: boolean) => void;
}

function EditDepartmentDialog({ department, onOpenChange }: EditDepartmentDialogProps) {
  const updateDepartment = useUpdateDepartmentMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditDepartmentFormValues>({
    resolver: zodResolver(editDepartmentSchema),
    values: department
      ? {
          name: department.name,
          code: department.code,
          description: department.description ?? '',
        }
      : undefined,
  });

  if (!department) return null;

  const onSubmit = async (values: EditDepartmentFormValues) => {
    try {
      await updateDepartment.mutateAsync({
        id: department.id,
        payload: {
          ...values,
          code: values.code.toUpperCase(),
          description: values.description || null,
        },
      });
      toast.success('Department updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {department.name}</DialogTitle>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" disabled={isSubmitting} {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-code">Code</Label>
            <Input id="edit-code" placeholder="e.g. ENG-01" disabled={isSubmitting} {...register('code')} />
            <p className="text-sm text-muted-foreground">
              2-30 letters, numbers, underscores, or dashes. Will be converted to uppercase.
            </p>
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
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

export { EditDepartmentDialog };
