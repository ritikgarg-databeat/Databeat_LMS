import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving conflicting utilities (e.g. `p-2` vs `p-4`)
 * in favor of the last one specified. Used by every component in `components/ui`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
