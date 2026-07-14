import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthContext, type AuthContextValue } from '@/contexts/auth-context';
import { authApi } from '@/features/auth/services';
import type { AuthUser, LoginPayload } from '@/features/auth/types';
import { queryClient } from '@/lib/query-client';
import { registerSessionExpiredHandler, setAccessToken } from '@/services/api/client';

/**
 * Session bootstrap, current-user context, and the global "session expired" handler
 * (ARCHITECTURE.md §9). On mount, silently exchanges the httpOnly refresh cookie for a
 * fresh access token — this is what makes a page reload not immediately look logged out
 * even though the access token itself lives only in memory (see services/api/client.ts).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guards against React 19 StrictMode's intentional double-invocation of effects in
  // development. Without this, bootstrap fires /auth/refresh twice back-to-back; the
  // second call presents a refresh token the first call already rotated out, which the
  // backend's reuse-detection (correctly, by design — see auth.service.ts `refresh()`)
  // treats as a stolen-token replay and revokes the entire session. A ref (not state)
  // survives StrictMode's synthetic unmount+remount of this same component instance,
  // so the actual network call only ever fires once per real mount.
  const bootstrapStarted = useRef(false);

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;

    async function bootstrapSession() {
      try {
        const { accessToken } = await authApi.refresh();
        setAccessToken(accessToken);
        const me = await authApi.me();
        setUserState(me);
      } catch {
        // No valid session yet — the normal case for a first-time or logged-out visitor.
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrapSession();
  }, []);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setUserState(null);
      queryClient.clear();
    });
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<AuthUser> => {
    const result = await authApi.login(payload);
    setAccessToken(result.accessToken);
    setUserState(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUserState(null);
      queryClient.clear();
    }
  }, []);

  const setUser = useCallback((next: AuthUser) => setUserState(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, isLoading, login, logout, setUser }),
    [user, isLoading, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
