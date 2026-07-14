import { useCallback, useEffect, useMemo, useState } from 'react';

import { ThemeContext, type Theme } from '@/contexts/theme-context';
import { storage } from '@/utils/storage';
import { THEME_STORAGE_KEY, applyThemeClass, getSystemTheme } from '@/utils/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    storage.get<Theme>(THEME_STORAGE_KEY, getSystemTheme()),
  );

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    storage.set(THEME_STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
