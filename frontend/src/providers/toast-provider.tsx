import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';

/** Mounts the toast renderer once at the app root. Trigger toasts via `toast()` from 'sonner'. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <>
      {children}
      <Toaster theme={theme} position="top-right" richColors closeButton />
    </>
  );
}
