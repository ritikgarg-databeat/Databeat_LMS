import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AuthUser } from '@/features/auth/types';
import { getErrorMessage } from '@/utils/error';

import { useDepartmentsQuery, useExperienceLevelsQuery, useUpdateUserMutation } from '../hooks';

const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(60),
  lastName: z.string().min(1, 'Last name is required.').max(60),
  departmentId: z.string().optional(),
  experienceLevelId: z.string().optional(),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

export interface EditUserDialogProps {
  user: AuthUser | null;
  onOpenChange: (open: boolean) => void;
  showExperienceLevel: boolean;
}

function EditUserDialog({ user, onOpenChange, showExperienceLevel }: EditUserDialogProps) {
  const updateUser = useUpdateUserMutation();
  const { data: departments } = useDepartmentsQuery();
  const { data: experienceLevels } = useExperienceLevelsQuery();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    values: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          departmentId: user.departmentId ?? '',
          experienceLevelId: user.experienceLevelId ?? '',
        }
      : undefined,
  });

  if (!user) return null;

  const onSubmit = async (values: EditUserFormValues) => {
    try {
      // The "None" <option> has value="" — normalize it to null/undefined or the backend's
      // isUUID() validators reject the empty string as an invalid value.
      await updateUser.mutateAsync({
        id: user.id,
        payload: {
          ...values,
          departmentId: values.departmentId || null,
          experienceLevelId: values.experienceLevelId || null,
        },
      });
      toast.success('User updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.fullName}</DialogTitle>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First name</Label>
              <Input id="edit-firstName" disabled={isSubmitting} {...register('firstName')} />
              {errors.firstName ? (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last name</Label>
              <Input id="edit-lastName" disabled={isSubmitting} {...register('lastName')} />
              {errors.lastName ? <p className="text-sm text-destructive">{errors.lastName.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-departmentId">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments?.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {showExperienceLevel ? (
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
                        <SelectValue placeholder="Select an experience level" />
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

export { EditUserDialog };
