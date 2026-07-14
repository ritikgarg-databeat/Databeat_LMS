import type { Role } from '@prisma/client';

// Internal domain types for the qna-comments module.

/** Caller identity threaded through the service layer for RBAC/ownership checks. */
export interface Actor {
  id: string;
  role: Role;
}
