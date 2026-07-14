import { createContext } from 'react';

import type { AuthUser, LoginPayload } from '@/features/auth/types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True only during the initial session-bootstrap check on app load. */
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

/**
 * Context object only — implementation lives in `providers/auth-provider.tsx` (same split
 * as theme-context.ts, see ARCHITECTURE.md-aligned foundation from Prompt 2).
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
