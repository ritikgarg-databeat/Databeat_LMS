import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthenticatedAvatarUrl } from '@/features/settings/hooks';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { profileApi } from '../services';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(60),
  lastName: z.string().min(1, 'Last name is required.').max(60),
  avatar: z.string().url('Enter a valid URL.').or(z.literal('')).optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

/**
 * Every role can view their own profile and edit name/avatar here. Role, department, and
 * permissions are intentionally not editable from this page — see USER MANAGEMENT spec
 * ("Trainee cannot change role, department, or permissions"), enforced again server-side
 * by `UpdateOwnProfileDto` regardless of what this form sends.
 */
function ProfilePage() {
  const { user, setUser } = useAuth();
  const { url: avatarUrl } = useAuthenticatedAvatarUrl(user?.avatar);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      avatar: user?.avatar ?? '',
    },
  });

  if (!user) return null;

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const updated = await profileApi.updateOwnProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        avatar: values.avatar || null,
      });
      setUser(updated);
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">View and update your account information.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <Avatar className="size-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {user.firstName[0]}
              {user.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{user.fullName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            <Badge variant="secondary" className="mt-1">
              {user.role}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                {errors.lastName ? (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input id="avatar" placeholder="https://..." disabled={isSubmitting} {...register('avatar')} />
              {errors.avatar ? <p className="text-sm text-destructive">{errors.avatar.message}</p> : null}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="outline" asChild>
                {/* Relative link: profile/change-password are sibling routes nested under
                    each role's layout (e.g. /trainer/profile, /trainer/change-password). */}
                <Link to="../change-password">Change password</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export { ProfilePage };
