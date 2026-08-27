import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        success: 'border-transparent bg-success text-success-foreground shadow',
        warning: 'border-transparent bg-warning text-warning-foreground shadow',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /**
   * Renders a small ambient-pulsing dot before the label — reserved for genuine "live"/active-state
   * emphasis (e.g. an in-progress session, an open question). Opt-in and rare by design: this should
   * read as a deliberate signal, not decoration on every badge. Respects `prefers-reduced-motion`
   * (falls back to a static dot via `motion-safe:`).
   */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span className="relative mr-1.5 flex size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-glow-pulse" />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
