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
import { getErrorMessage } from '@/utils/error';

import { useActiveDepartmentsOptions, useActiveExperienceLevelsOptions, useUpdateGroupMutation } from '../hooks';
import type { Group } from '../types';

// Case-insensitive here — the value is uppercased on submit before being sent to the API,
// which itself only accepts the uppercase form (see backend groups.validation.ts).
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;

const editGroupSchema = z
  .object({
    name: z.string().min(1, 'Name is required.').max(150, 'Name must be 150 characters or fewer.'),
    code: z
      .string()
      .min(1, 'Code is required.')
      .regex(CODE_PATTERN, 'Code must be 2-40 letters, numbers, underscores, or dashes.'),
    departmentId: z.string().min(1, 'Department is required.'),
    experienceLevelId: z.string().optional(),
    description: z.string().max(1000, 'Description must be 1000 characters or fewer.').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    // Kept as a raw string (matching the native <input type="number"> value) and converted to
    // a number only at submit time — avoids a zod `preprocess` mismatch between the resolver's
    // input/output types under react-hook-form's `useForm<T>` generic.
    capacity: z
      .string()
      .optional()
      .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Capacity must be a positive whole number.'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.startDate <= values.endDate, {
    message: 'End date must be on or after the start date.',
    path: ['endDate'],
  });
type EditGroupFormValues = z.infer<typeof editGroupSchema>;

export interface EditGroupDialogProps {
  group: Group | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Trainer is deliberately not editable here — `PATCH /groups/:id` doesn't accept `trainerId`;
 * reassignment goes through the dedicated "Assign Trainer" action (assign-trainer-dialog.tsx).
 */
function EditGroupDialog({ group, onOpenChange }: EditGroupDialogProps) {
  const updateGroup = useUpdateGroupMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: experienceLevels } = useActiveExperienceLevelsOptions();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditGroupFormValues>({
    resolver: zodResolver(editGroupSchema),
    values: group
      ? {
          name: group.name,
          code: group.code,
          departmentId: group.departmentId,
          experienceLevelId: group.experienceLevelId ?? '',
          description: group.description ?? '',
          startDate: group.startDate ? group.startDate.slice(0, 10) : '',
          endDate: group.endDate ? group.endDate.slice(0, 10) : '',
          capacity: group.capacity !== null ? String(group.capacity) : '',
        }
      : undefined,
  });

  if (!group) return null;

  const onSubmit = async (values: EditGroupFormValues) => {
    try {
      // The "None" <option> has value="" — normalize it to null or the backend's optional-field
      // validators reject the empty string as an invalid uuid/date.
      await updateGroup.mutateAsync({
        id: group.id,
        payload: {
          name: values.name,
          code: values.code.toUpperCase(),
          departmentId: values.departmentId,
          experienceLevelId: values.experienceLevelId || null,
          description: values.description || null,
          startDate: values.startDate || null,
          endDate: values.endDate || null,
          capacity: values.capacity ? Number(values.capacity) : null,
        },
      });
      toast.success('Group updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {group.name}</DialogTitle>
          <DialogDescription>Update the group&apos;s details.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" disabled={isSubmitting} {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-code">Code</Label>
            <Input id="edit-code" disabled={isSubmitting} {...register('code')} />
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="edit-departmentId">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId ? (
                <p className="text-sm text-destructive">{errors.departmentId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-experienceLevelId">Experience level</Label>
              <Controller
                name="experienceLevelId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-experienceLevelId">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {experienceLevels?.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Start date</Label>
              <Input id="edit-startDate" type="date" disabled={isSubmitting} {...register('startDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endDate">End date</Label>
              <Input id="edit-endDate" type="date" disabled={isSubmitting} {...register('endDate')} />
              {errors.endDate ? <p className="text-sm text-destructive">{errors.endDate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-capacity">Capacity</Label>
            <Input id="edit-capacity" type="number" min={1} disabled={isSubmitting} {...register('capacity')} />
            {errors.capacity ? <p className="text-sm text-destructive">{errors.capacity.message}</p> : null}
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

export { EditGroupDialog };
