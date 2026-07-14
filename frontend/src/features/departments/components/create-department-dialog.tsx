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

import { useCreateDepartmentMutation } from '../hooks';

// Case-insensitive here — the value is uppercased on submit before being sent to the API,
// which itself only accepts the uppercase form (see backend departments.validation.ts).
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,30}$/;

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(80, 'Name must be 80 characters or fewer.'),
  code: z
    .string()
    .min(1, 'Code is required.')
    .regex(CODE_PATTERN, 'Code must be 2-30 letters, numbers, underscores, or dashes.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
});
type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>;

export interface CreateDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateDepartmentDialog({ open, onOpenChange }: CreateDepartmentDialogProps) {
  const createDepartment = useCreateDepartmentMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDepartmentFormValues>({ resolver: zodResolver(createDepartmentSchema) });

  const onSubmit = async (values: CreateDepartmentFormValues) => {
    try {
      await createDepartment.mutateAsync({
        ...values,
        code: values.code.toUpperCase(),
        description: values.description || undefined,
      });
      toast.success('Department created successfully.');
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
          <DialogTitle>Create Department</DialogTitle>
          <DialogDescription>Add a new department to the organization.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" disabled={isSubmitting} {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="e.g. ENG-01" disabled={isSubmitting} {...register('code')} />
            <p className="text-sm text-muted-foreground">
              2-30 letters, numbers, underscores, or dashes. Will be converted to uppercase.
            </p>
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
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

export { CreateDepartmentDialog };
