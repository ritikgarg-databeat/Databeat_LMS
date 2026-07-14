import type { Role } from '@/constants/roles';

/**
 * Augments Express's Request type so `req.user` is known everywhere once `authenticate`
 * (see middleware/auth.middleware.ts) actually populates it. Declared now so the auth
 * module's future implementation is a pure addition, not a type-surface change.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        mustChangePassword: boolean;
      };
    }
  }
}

export {};
