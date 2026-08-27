import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { getChangePasswordPath, getDashboardPath, ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { Checkbox } from '../components';
import { loginSchema, type LoginFormValues } from '../utils';

/** Wired to the real auth flow — see providers/auth-provider.tsx and services/api/client.ts. */
function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  // Bumped on every failed login attempt to re-key the shake wrapper below, replaying its
  // initial->animate transition exactly once per failure (never loops). Left at 0 (and the
  // wrapper never re-keyed) when the user prefers reduced motion, so no shake ever fires.
  const [shakeAttempt, setShakeAttempt] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const user = await login(values);

      // A first-login (or admin-reset) account must change its password before doing
      // anything else — this overrides even an explicit redirect-back destination, since
      // the server would 403 every other request anyway (see route-guard.tsx / the
      // backend's require-password-change.middleware.ts).
      if (user.mustChangePassword) {
        navigate(getChangePasswordPath(user.role), { replace: true });
        toast.success(`Welcome, ${user.firstName}. Please change your password to continue.`);
        return;
      }

      const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(redirectTo || getDashboardPath(user.role), { replace: true });
      toast.success(`Welcome back, ${user.firstName}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setShakeAttempt((attempt) => attempt + 1);
    }
  };

  return (
    <motion.div
      key={shouldReduceMotion ? 'static' : shakeAttempt}
      initial={{ x: 0 }}
      animate={!shouldReduceMotion && shakeAttempt > 0 ? { x: [0, -8, 8, -8, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to access your account.</p>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            {...register('password')}
          />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="rememberMe" disabled={isSubmitting} {...register('rememberMe')} />
          <Label htmlFor="rememberMe" className="cursor-pointer font-normal text-muted-foreground">
            Remember me
          </Label>
        </div>

        <Button type="submit" className="w-full transition-all hover:shadow-glow" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" className="text-primary-foreground" /> : null}
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </motion.div>
  );
}

export { LoginPage };
