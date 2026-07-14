import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Shimmer sheen (see globals.css `.animate-shimmer`) reads as more premium than a flat pulse and
  // is reduced-motion-safe by construction — under `prefers-reduced-motion: reduce` the gradient
  // stays put as a static soft highlight instead of animating.
  return <div className={cn('rounded-md bg-muted animate-shimmer', className)} {...props} />;
}

export { Skeleton };
