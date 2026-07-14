import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/utils/error';

import { authApi } from '../services';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../utils';

/**
 * Calls the real (stub) backend endpoint — it always responds as if it succeeded, whether
 * or not the email exists, so account existence is never revealed (ARCHITECTURE.md §17).
 * Actual email delivery is deferred; see auth.service.ts `forgotPassword()`.
 */
function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await authApi.forgotPassword(values);
      setSubmitted(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, password reset instructions have been sent.
        </p>
        <Link to={ROUTES.LOGIN} className="block text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you instructions to reset your password.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send reset instructions'}
      </Button>

      <Link
        to={ROUTES.LOGIN}
        className="block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Back to sign in
      </Link>
    </form>
  );
}

export { ForgotPasswordPage };
