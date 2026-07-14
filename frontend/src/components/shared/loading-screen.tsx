import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export interface LoadingScreenProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  fullScreen?: boolean;
}

/** Full-page (or full-container) loading state, used while route data or the session is resolving. */
function LoadingScreen({
  message = 'Loading...',
  fullScreen = true,
  className,
  ...props
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'h-svh w-full' : 'h-full min-h-40 w-full',
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export { LoadingScreen };
