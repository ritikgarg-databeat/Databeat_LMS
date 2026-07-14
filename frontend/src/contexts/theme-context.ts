import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Context object only — no logic here. The implementation lives in
 * `providers/theme-provider.tsx` so the two can evolve independently
 * (e.g. swapping localStorage persistence for a user preference API call later).
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
