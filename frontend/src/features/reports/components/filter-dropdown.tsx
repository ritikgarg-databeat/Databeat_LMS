import { Check, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface FilterDropdownOption {
  value: string;
  label: string;
}

export interface FilterDropdownProps {
  label: string;
  /** First entry is the "clear" option (e.g. `{ value: '', label: 'All groups' }`). */
  options: FilterDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Reusable button + dropdown-menu filter picker for the reports page — there's no `ui/select`
 * primitive in this codebase yet, so every report filter (group/course/assessment) reuses this
 * one component instead of hand-rolling a menu per filter.
 */
function FilterDropdown({ label, options, value, onChange, className }: FilterDropdownProps) {
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('justify-between gap-2', className)}>
          <span className="truncate">
            <span className="text-muted-foreground">{label}: </span>
            {current?.label ?? label}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value || '__all__'}
            onSelect={() => onChange(option.value)}
            className="justify-between gap-2"
          >
            {option.label}
            {option.value === value ? <Check className="size-4" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { FilterDropdown };
