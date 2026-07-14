import { randomInt } from 'node:crypto';

import bcrypt from 'bcrypt';

import { APP_CONFIG } from '@/config/app.config';

/** Hashes a plaintext password for storage. Never store or log the plaintext value. */
export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, APP_CONFIG.BCRYPT_SALT_ROUNDS);
}

/** Compares a login attempt's plaintext password against the stored hash. */
export async function comparePassword(plainTextPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, hash);
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)] as string;
}

/**
 * Generates a random password that satisfies `PASSWORD_POLICY_REGEX` by construction —
 * used when a trainer/admin resets a user's password without supplying one explicitly.
 * Excludes visually ambiguous characters (0/O, 1/l/I) to keep it easy to relay/retype.
 */
export function generateTemporaryPassword(length = 12): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));

  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the guaranteed-category characters aren't always in the same position.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }

  return chars.join('');
}
