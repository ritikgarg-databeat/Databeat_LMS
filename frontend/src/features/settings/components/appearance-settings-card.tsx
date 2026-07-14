// "Appearance" card: a Light / Dark / System theme selector wired to BOTH the backend
// (persisted via `useUpdateThemeMutation`) and the local `ThemeProvider` (via `useTheme().setTheme`)
// so the page repaints immediately instead of only taking effect after the next reload.
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/utils/error';
import { getSystemTheme } from '@/utils/theme';

import { useSettingsQuery, useUpdateThemeMutation } from '../hooks';
import type { ThemePreference } from '../types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
  { value: 'SYSTEM', label: 'System' },
];

function AppearanceSettingsCard() {
  const { data, isLoading } = useSettingsQuery();
  const updateThemeMutation = useUpdateThemeMutation();
  const { setTheme } = useTheme();

  const handleThemeChange = (value: string) => {
    const theme = value as ThemePreference;

    // Repaint immediately — persisting to the backend alone would leave the UI stale until
    // the next reload, since `ThemeProvider`'s own state is plain React context, not derived
    // from this query.
    setTheme(theme === 'SYSTEM' ? getSystemTheme() : theme === 'DARK' ? 'dark' : 'light');

    updateThemeMutation.mutate(theme, {
      onSuccess: () => toast.success('Theme updated.'),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how Databeat LMS looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-48" />
        ) : (
          <div className="max-w-xs space-y-2">
            <Select value={data?.theme ?? 'SYSTEM'} onValueChange={handleThemeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { AppearanceSettingsCard };
