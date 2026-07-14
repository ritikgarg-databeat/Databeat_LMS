import type { Theme } from '@/contexts/theme-context';

const THEME_STORAGE_KEY = 'databeat-lms:theme';

/** Reads the OS-level color scheme preference, used the first time a user has no saved theme. */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Toggles the `dark` class on <html>, which Tailwind's dark-mode variant and index.css key off of. */
export function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export { THEME_STORAGE_KEY };
