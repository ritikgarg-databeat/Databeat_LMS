import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDashboardPath } from '@/constants/routes';
import { useAuth } from '@/hooks/use-auth';
import { setAccessToken } from '@/services/api/client';
import { getErrorMessage } from '@/utils/error';

import { authApi } from '../services';
import { changePasswordSchema, PASSWORD_POLICY_DESCRIPTION, type ChangePasswordFormValues } from '../utils';

/**
 * Available to any authenticated role (Trainee "Change own password", Trainer, Super Admin) —
 * and also the forced destination for an account whose password has never been changed
 * (`mustChangePassword`, Prompt 10 § Part 6 — enforced server-side, see
 * require-password-change.middleware.ts; this page/guard is just the matching UX). The backend
 * revokes every other session on success and returns a fresh token pair (and the updated user)
 * for this one, so this device stays signed in — see auth.service.ts `changePassword()`.
 */
function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const wasForced = user?.mustChangePassword === true;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      const { user: updatedUser, accessToken } = await authApi.changePassword(values);
      setAccessToken(accessToken);
      // Reflects `mustChangePassword: false` immediately — clears the route guard without an
      // extra `/auth/me` round-trip (see providers/auth-provider.tsx `setUser`).
      setUser(updatedUser);
      reset();
      toast.success('Password changed successfully. Your other sessions have been signed out.');

      if (wasForced) {
        navigate(getDashboardPath(updatedUser.role), { replace: true });
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Change Password</h1>
        <p className="text-muted-foreground">Update the password used to sign in to your account.</p>
      </div>

      {wasForced ? (
        // Extra background tint + explicit foreground color (beyond the shared Alert
        // component's own `warning` variant, which only sets border/icon color) so this
        // security-relevant notice carries real visual weight — same --warning token,
        // not the brand primary/accent gradient, so its meaning stays legible.
        <Alert variant="warning" className="border-warning/60 bg-warning/10 text-foreground">
          <ShieldAlert aria-hidden className="text-warning" />
          <AlertTitle>Password change required</AlertTitle>
          <AlertDescription className="text-foreground/80">
            Your account requires a password change before continuing.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>{PASSWORD_POLICY_DESCRIPTION}</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                {...register('currentPassword')}
              />
              {errors.currentPassword ? (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...register('newPassword')}
              />
              {errors.newPassword ? (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword ? (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export { ChangePasswordPage };
