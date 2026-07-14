import type { User } from '@prisma/client';

import type { SafeUser } from '@/modules/auth/auth.types';

/**
 * Strips `passwordHash` and computes `fullName` (not a stored column — see
 * ARCHITECTURE.md §6 seed/data-modeling notes). Used by every module that returns a
 * user to the client (auth, users) so the "never expose password hashes" rule
 * (this phase's Security spec) is enforced in exactly one place.
 */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    experienceLevelId: user.experienceLevelId,
    avatar: user.avatar,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    lastLogin: user.lastLogin,
    passwordChangedAt: user.passwordChangedAt,
    mustChangePassword: user.passwordChangedAt === null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
