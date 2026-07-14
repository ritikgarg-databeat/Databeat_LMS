import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '@/config/env';

/**
 * Generic JWT sign/verify helpers. The Auth module (next phase) decides what goes in the
 * payload (userId, role, permissionsVersion — see ARCHITECTURE.md §9); this file only
 * wraps the token mechanics so that logic isn't duplicated across access/refresh handling.
 */
export function signAccessToken(payload: object): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES } as SignOptions);
}

export function verifyAccessToken<T>(token: string): T {
  return jwt.verify(token, env.JWT_SECRET) as T;
}

export function signRefreshToken(payload: object, expiresIn: string = env.REFRESH_EXPIRES): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn } as SignOptions);
}

export function verifyRefreshToken<T>(token: string): T {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as T;
}
