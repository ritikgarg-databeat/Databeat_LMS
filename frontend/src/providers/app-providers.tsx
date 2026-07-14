import { AIProvider } from '@/providers/ai-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { NotificationProvider } from '@/providers/notification-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

/**
 * Single composition root for every context provider in the app. Order matters:
 * Theme must wrap Toast (the toaster reads the current theme), and Auth should wrap
 * Notification/AI once implemented, since both will depend on the current user.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <AIProvider>{children}</AIProvider>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
