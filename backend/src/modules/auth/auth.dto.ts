import type { SafeUser } from '@/modules/auth/auth.types';

export interface LoginDto {
  email: string;
  password: string;
  /** "Remember me" (Prompt 9) — extends the refresh-token session past the default. */
  rememberMe?: boolean;
}

export interface LoginResponseDto {
  user: SafeUser;
  accessToken: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface RefreshResponseDto {
  accessToken: string;
}
