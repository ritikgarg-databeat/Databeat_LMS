import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
};

/** Inline loading indicator. For a full-page loading state, use `@/components/shared/loading-screen`. */
function Spinner({ className, size = 'md', ...props }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
      {...props}
    />
  );
}

export { Spinner };
