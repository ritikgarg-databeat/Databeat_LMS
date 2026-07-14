import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Minimal accessible checkbox scoped to the auth feature, predating the shared Radix-based
 * `components/ui/checkbox.tsx` (added later in the same prompt). Wraps a real native
 * `<input type="checkbox">` (kept visually hidden but focusable/clickable, preserving keyboard
 * operation, focus-visible ring, and label association via `htmlFor`) with a styled indicator box
 * driven by `peer-*` variants. Left as-is rather than swapped to the shared component — it works
 * correctly and the login form's RHF `register()` wiring already depends on its native-input ref.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <span className="relative inline-flex size-4 shrink-0">
      <input
        type="checkbox"
        ref={ref}
        className={cn('peer absolute inset-0 size-4 cursor-pointer appearance-none opacity-0', className)}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex size-4 items-center justify-center rounded-sm border border-input shadow-sm transition-colors',
          'peer-checked:border-primary peer-checked:bg-primary',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        )}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
