import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/utils/error';

import { authApi } from '../services';
import {
  PASSWORD_POLICY_DESCRIPTION,
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '../utils';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [completed, setCompleted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) return;
    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword });
      setCompleted(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Invalid reset link</h1>
        <p className="text-sm text-muted-foreground">Request a new password reset email and try again.</p>
        <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Password reset</h1>
        <p className="text-sm text-muted-foreground">Your password was changed and all existing sessions were signed out.</p>
        <Link to={ROUTES.LOGIN} className="text-sm text-primary hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">{PASSWORD_POLICY_DESCRIPTION}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" disabled={isSubmitting} {...register('newPassword')} />
        {errors.newPassword ? <p className="text-sm text-destructive">{errors.newPassword.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" disabled={isSubmitting} {...register('confirmPassword')} />
        {errors.confirmPassword ? <p className="text-sm text-destructive">{errors.confirmPassword.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Resetting...' : 'Reset password'}
      </Button>
    </form>
  );
}

export { ResetPasswordPage };
