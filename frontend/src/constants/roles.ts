/** The three platform roles, per the approved architecture (docs/../ARCHITECTURE.md §9-10). */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TRAINER: 'TRAINER',
  TRAINEE: 'TRAINEE',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
