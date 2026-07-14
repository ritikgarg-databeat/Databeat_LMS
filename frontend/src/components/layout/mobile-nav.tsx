import { motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

import type { SidebarNavItem } from '@/components/layout/sidebar';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export interface MobileNavProps {
  items: SidebarNavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header?: React.ReactNode;
}

/** Scoped separately from `sidebar.tsx`'s indicator id — see that file's comment on why. */
const MOBILE_NAV_ACTIVE_INDICATOR_LAYOUT_ID = 'mobile-nav-active-indicator';

/**
 * Drawer-based navigation for viewports below the `lg` breakpoint, opened from the Header.
 * Always shows full icon+label rows regardless of the desktop sidebar's collapsed state — the
 * two navs are independent (`isSidebarCollapsed` in `ui-store.ts` only affects `Sidebar`).
 */
function MobileNav({ items, open, onOpenChange, header }: MobileNavProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="lg:hidden">
        <DrawerTitle className="sr-only">Navigation</DrawerTitle>
        {header ? <div className="border-b px-4 py-3">{header}</div> : null}
        <nav className="flex flex-col gap-1 p-3" aria-label="Primary navigation">
          {items.map(({ label, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              onClick={() => onOpenChange(false)}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  // Matches the desktop sidebar's primary-tinted active treatment (sidebar.tsx) —
                  // kept in sync so the nav reads identically whichever surface is open.
                  isActive && 'text-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    shouldReduceMotion ? (
                      <span
                        className="absolute inset-0 rounded-md border-l-2 border-primary bg-primary/10"
                        aria-hidden
                      />
                    ) : (
                      <motion.span
                        layoutId={MOBILE_NAV_ACTIVE_INDICATOR_LAYOUT_ID}
                        className="absolute inset-0 rounded-md border-l-2 border-primary bg-primary/10"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        aria-hidden
                      />
                    )
                  ) : null}
                  <Icon className="relative size-4 shrink-0" aria-hidden />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}

export { MobileNav };
