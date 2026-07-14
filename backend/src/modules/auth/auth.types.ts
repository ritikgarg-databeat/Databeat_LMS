import type { Role } from '@/constants/roles';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /** Optional for backward compatibility with tokens signed before this field existed. */
  mustChangePassword?: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  /** Optional for backward compatibility with tokens signed before this field existed. */
  rememberMe?: boolean;
}

/** User shape safe to send to the client — `passwordHash` is never included. */
export interface SafeUser {
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
  lastLogin: Date | null;
  passwordChangedAt: Date | null;
  /** Derived from `passwordChangedAt === null` — never a stored column (see user-mapper.util.ts). */
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}
