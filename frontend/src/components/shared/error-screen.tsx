import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorScreenProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Full-container error state for failed route data/queries. Pair with an error boundary. */
function ErrorScreen({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
  ...props
}: ErrorScreenProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-64 w-full flex-col items-center justify-center gap-3 text-center',
        className,
      )}
      role="alert"
      {...props}
    >
      <AlertTriangle className="size-10 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export { ErrorScreen };
