import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { REFRESH_TOKEN_COOKIE, clearRefreshTokenCookie, setRefreshTokenCookie } from '@/utils/cookie.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { ChangePasswordDto, ForgotPasswordDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import type { RequestContext } from './auth.service';

// HTTP request handlers for the auth module. No business logic here — see auth.service.ts.
export class AuthController extends BaseController {
  constructor(protected readonly service: AuthService = new AuthService()) {
    super();
  }

  private requestContext(req: Request): RequestContext {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  login = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const { email, password, rememberMe } = req.body as LoginDto;

    const { user, accessToken, refreshToken } = await this.service.login(
      email,
      password,
      this.requestContext(req),
      rememberMe,
    );

    setRefreshTokenCookie(res, refreshToken, rememberMe);
    this.ok(res, { user, accessToken }, 'Signed in successfully.');
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.service.logout(refreshToken, this.requestContext(req));
    clearRefreshTokenCookie(res);
    this.ok(res, null, 'Signed out successfully.');
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
    const { accessToken, refreshToken: newRefreshToken, rememberMe } = await this.service.refresh(
      refreshToken,
      this.requestContext(req),
    );

    setRefreshTokenCookie(res, newRefreshToken, rememberMe);
    this.ok(res, { accessToken }, 'Session refreshed.');
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const { currentPassword, newPassword } = req.body as ChangePasswordDto;
    await this.service.changePassword(req.user.id, currentPassword, newPassword);

    // Re-issue a fresh pair so the device the change was made from stays signed in
    // (changePassword revoked every session, including this request's own). Passes the
    // outgoing cookie's own refresh token through so the reissued session preserves its
    // `rememberMe` flag instead of silently reverting to the 7-day default.
    const previousRefreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;
    const { user, accessToken, refreshToken, rememberMe } = await this.service.reissueSession(
      req.user.id,
      this.requestContext(req),
      previousRefreshToken,
    );

    setRefreshTokenCookie(res, refreshToken, rememberMe);
    this.ok(res, { user, accessToken }, 'Password changed successfully.');
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.getMe(req.user.id);
    this.ok(res, user);
  };

  validate = (req: Request, res: Response): void => {
    if (!req.user) throw new UnauthorizedError();
    this.ok(res, { valid: true }, 'Token is valid.');
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const { email } = req.body as ForgotPasswordDto;
    await this.service.forgotPassword(email);
    // Same response whether or not the email exists — see auth.service.ts forgotPassword().
    this.ok(res, null, 'If an account exists for that email, password reset instructions have been sent.');
  };
}
