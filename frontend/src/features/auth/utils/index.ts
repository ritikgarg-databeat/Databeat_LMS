import { z } from 'zod';

/**
 * Mirrors the backend's PASSWORD_POLICY_REGEX (backend/src/constants/auth.constants.ts) —
 * keep both in sync if this changes.
 */
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_POLICY_DESCRIPTION =
  'Must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  // Optional rather than `.default()` — with @hookform/resolvers' zodResolver, a Zod `.default()`
  // makes the resolver's *input* type diverge from its *output* type (input: optional, output:
  // required), which RHF's `Resolver<LoginFormValues>` generic can't reconcile. The actual
  // default (unchecked/false) is instead seeded via `useForm({ defaultValues })` in login-page.tsx.
  rememberMe: z.boolean().optional(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_DESCRIPTION),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_DESCRIPTION),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
