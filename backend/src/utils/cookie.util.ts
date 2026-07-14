import type { CookieOptions, Response } from 'express';
import ms from 'ms';

import { env, isProduction } from '@/config/env';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

/**
 * The refresh token travels as an httpOnly cookie — never readable by client JS, never
 * stored in localStorage (ARCHITECTURE.md §9). `secure` is only forced in production so
 * local HTTP development still works; `sameSite: lax` allows the top-level navigation
 * a login redirect performs while still blocking cross-site XHR/fetch from sending it.
 */
function refreshCookieOptions(rememberMe: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: ms((rememberMe ? env.REFRESH_EXPIRES_REMEMBER_ME : env.REFRESH_EXPIRES) as ms.StringValue),
  };
}

/** `rememberMe` only ever LENGTHENS the cookie's lifetime past the existing default — see env.ts. */
export function setRefreshTokenCookie(res: Response, token: string, rememberMe = false): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, refreshCookieOptions(rememberMe));
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...refreshCookieOptions(false), maxAge: undefined });
}
