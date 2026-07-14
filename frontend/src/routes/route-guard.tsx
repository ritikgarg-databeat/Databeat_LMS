import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/shared';
import type { Role } from '@/constants/roles';
import { ROUTES, getChangePasswordPath, getDashboardPath } from '@/constants/routes';
import { useAuth } from '@/hooks/use-auth';

export interface RouteGuardProps {
  allowedRoles?: Role[];
}

/**
 * Redirects to /login when unauthenticated (preserving the intended destination so login
 * can return the user there) and to /403 when the current user's role isn't in
 * `allowedRoles` (ARCHITECTURE.md §9-10). Renders a loading screen during the initial
 * session-bootstrap check so an authenticated user never flashes through the login page
 * on a hard refresh.
 *
 * Also mirrors the server-side force-password-change gate (Prompt 10 § Part 6,
 * require-password-change.middleware.ts): while `user.mustChangePassword` is true, any
 * route other than the change-password page itself redirects there — purely a UX nicety
 * so the user never lands on a screen whose API calls would 403 anyway.
 */
function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  if (user?.mustChangePassword) {
    const changePasswordPath = getChangePasswordPath(user.role);
    if (location.pathname !== changePasswordPath) {
      return <Navigate to={changePasswordPath} replace />;
    }
  }

  return <Outlet />;
}

/** Wraps /login and /forgot-password — an already-authenticated user is sent to their dashboard. */
function GuestOnlyRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated && user) {
    const destination = user.mustChangePassword ? getChangePasswordPath(user.role) : getDashboardPath(user.role);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

export { RouteGuard, GuestOnlyRoute };
