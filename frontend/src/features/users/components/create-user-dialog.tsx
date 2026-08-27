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
import type { Role } from '@/constants/roles';
import { PASSWORD_POLICY_DESCRIPTION, PASSWORD_POLICY_REGEX } from '@/features/auth/utils';
import { getErrorMessage } from '@/utils/error';

import { useCreateUserMutation, useDepartmentsQuery, useExperienceLevelsQuery } from '../hooks';

const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(60),
  lastName: z.string().min(1, 'Last name is required.').max(60),
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_DESCRIPTION),
  departmentId: z.string().optional(),
  experienceLevelId: z.string().optional(),
});
type CreateUserFormValues = z.infer<typeof createUserSchema>;

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The role being created — TRAINER (by Super Admin) or TRAINEE (by Trainer). */
  manageRole: Extract<Role, 'TRAINER' | 'TRAINEE'>;
}

function CreateUserDialog({ open, onOpenChange, manageRole }: CreateUserDialogProps) {
  const createUser = useCreateUserMutation();
  const { data: departments } = useDepartmentsQuery();
  const { data: experienceLevels } = useExperienceLevelsQuery();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema) });

  const onSubmit = async (values: CreateUserFormValues) => {
    try {
      // The "None" <option> has value="" — the backend's optional-field validators only
      // treat undefined/null as "not provided", so an empty string must be normalized
      // away here or it fails isUUID()/isIn() validation as an invalid value.
      await createUser.mutateAsync({
        ...values,
        role: manageRole,
        departmentId: values.departmentId || undefined,
        experienceLevelId: values.experienceLevelId || undefined,
      });
      toast.success(`${manageRole === 'TRAINER' ? 'Trainer' : 'Trainee'} created successfully.`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {manageRole === 'TRAINER' ? 'Trainer' : 'Trainee'}</DialogTitle>
          <DialogDescription>
            An initial password is set here — share it securely with the new user.
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" disabled={isSubmitting} {...register('firstName')} />
              {errors.firstName ? (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" disabled={isSubmitting} {...register('lastName')} />
              {errors.lastName ? <p className="text-sm text-destructive">{errors.lastName.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" disabled={isSubmitting} {...register('email')} />
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Initial password</Label>
            <Input id="password" type="password" disabled={isSubmitting} {...register('password')} />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="departmentId">
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

            {manageRole === 'TRAINEE' ? (
              <div className="space-y-2">
                <Label htmlFor="experienceLevelId">Experience level</Label>
                <Controller
                  name="experienceLevelId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="experienceLevelId">
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
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateUserDialog };
