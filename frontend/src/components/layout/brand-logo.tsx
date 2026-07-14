import databeatLogoDark from '@/assets/images/databeat-logo-dark.png';
import databeatLogoLight from '@/assets/images/databeat-logo-light.png';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  /** Optional role label shown beside the mark, e.g. "Admin" / "Trainer" / "Learn". */
  label?: string;
  className?: string;
  /** Controls the logo's rendered height — callers size it per context (compact sidebar rail vs.
   * a spacious header). Defaults to a compact nav-height. */
  imgClassName?: string;
}

/**
 * Databeat (a Mediamint company) wordmark. The source artwork's "DATABEAT"/"a mediamint company"
 * text is solid black, which disappears against any dark surface — `databeat-logo-dark.png` is a
 * pre-processed variant with only that near-black text inverted to white, leaving the chart-dot
 * brand graphic's own colors untouched, swapped in via `dark:` so it tracks the app's theme
 * toggle (see theme-provider.tsx / utils/theme.ts — the `dark` class on `<html>`).
 */
function BrandLogo({ label, className, imgClassName = 'h-8' }: BrandLogoProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <img src={databeatLogoLight} alt="Databeat" className={cn('w-auto shrink-0 dark:hidden', imgClassName)} />
      <img src={databeatLogoDark} alt="Databeat" className={cn('hidden w-auto shrink-0 dark:block', imgClassName)} />
      {label ? (
        <span className="truncate border-l pl-2.5 text-sm font-semibold text-foreground/80">{label}</span>
      ) : null}
    </div>
  );
}

export { BrandLogo };
