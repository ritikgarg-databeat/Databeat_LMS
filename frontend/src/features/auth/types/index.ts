import type { Role } from '@/constants/roles';

/** Mirrors the backend's SafeUser shape (ARCHITECTURE.md §9 — passwordHash is never sent). */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: Role;
  departmentId: string | null;
  experienceLevelId: string | null;
  avatar: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin: string | null;
  passwordChangedAt: string | null;
  /** Derived server-side from `passwordChangedAt === null` — true only until the first change. */
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  /** When true, the backend extends the refresh-token cookie's lifetime (30 days vs ~7). */
  rememberMe?: boolean;
}

export interface LoginResult {
  user: AuthUser;
  accessToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  user: AuthUser;
  accessToken: string;
}

export interface ForgotPasswordPayload {
  email: string;
}
