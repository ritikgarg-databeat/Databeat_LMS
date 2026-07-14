import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchBoxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  containerClassName?: string;
}

/** Debouncing/URL-syncing is left to the consuming feature; this is presentation-only. */
const SearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ value, onChange, onClear, containerClassName, className, placeholder = 'Search...', ...props }, ref) => {
    return (
      <div className={cn('relative flex items-center', containerClassName)}>
        <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden />
        <Input
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn('pl-8', value && 'pr-8', className)}
          {...props}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 size-7"
            onClick={() => (onClear ? onClear() : onChange(''))}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    );
  },
);
SearchBox.displayName = 'SearchBox';

export { SearchBox };
