// Internal domain types for the qna-answers module.
import type { Role } from '@prisma/client';

/** Minimal actor shape every service method needs for ownership/RBAC checks (mirrors the
 * `Actor` shape used by assessments.service.ts / resources.service.ts). */
export interface Actor {
  id: string;
  role: Role;
}
