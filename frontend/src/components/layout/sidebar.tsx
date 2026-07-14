import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type * as React from 'react';
import { NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarNavItem[];
  /** Rendered above the nav list, e.g. the product logo/name. Hidden while collapsed. */
  header?: React.ReactNode;
  /** Rendered below the nav list, pinned to the bottom (e.g. current-user summary). Hidden while collapsed. */
  footer?: React.ReactNode;
}

/** Shared with `mobile-nav.tsx` only as a naming convention, not an import — each nav owns its own
 * `motion.span`, but using the same `layoutId` string would cross-animate between them if both were
 * ever mounted at once, so each file scopes its id distinctly. */
const SIDEBAR_ACTIVE_INDICATOR_LAYOUT_ID = 'desktop-sidebar-active-indicator';

/**
 * Responsive desktop sidebar. Hidden below the `lg` breakpoint — mobile navigation is handled
 * separately by `MobileNav` and toggled from `Header`. Collapsible to an icon-only rail via
 * `useUIStore`'s `isSidebarCollapsed` (desktop-only — `MobileNav` always shows full labels).
 */
function Sidebar({ items, header, footer, className, ...props }: SidebarProps) {
  const isCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((state) => state.toggleSidebarCollapsed);
  const shouldReduceMotion = useReducedMotion();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex',
          isCollapsed ? 'w-16' : 'w-64',
          className,
        )}
        {...props}
      >
        {header && !isCollapsed ? <div className="flex h-16 items-center border-b px-4">{header}</div> : null}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1" aria-label="Primary navigation">
            {items.map(({ label, href, icon: Icon }) => (
              <SidebarNavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                isCollapsed={isCollapsed}
                shouldReduceMotion={shouldReduceMotion ?? false}
              />
            ))}
          </nav>
        </ScrollArea>
        {footer && !isCollapsed ? <div className="border-t p-3">{footer}</div> : null}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={toggleSidebarCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface SidebarNavLinkProps {
  href: string;
  label: string;
  Icon: LucideIcon;
  isCollapsed: boolean;
  shouldReduceMotion: boolean;
}

/**
 * A single nav row, split out from `Sidebar` so the collapsed state's tooltip-wrapping stays
 * readable (Tooltip only wraps the link when collapsed — expanded labels are already visible,
 * so a tooltip there would be redundant noise).
 */
function SidebarNavLink({ href, label, Icon, isCollapsed, shouldReduceMotion }: SidebarNavLinkProps) {
  // `className` is intentionally a plain string, NOT the `({ isActive }) => ...` callback form
  // react-router's NavLink also supports. When collapsed, this element is wrapped in
  // `TooltipTrigger asChild` below, and Radix's Slot merges the child's `className` prop via
  // `[a, b].filter(Boolean).join(' ')` (see `@radix-ui/react-slot`'s `mergeProps`) — that runs
  // BEFORE NavLink ever executes, so it silently stringifies a function prop (`fn.toString()`)
  // instead of calling it with `{ isActive }`, corrupting every collapsed nav row's class list.
  // The isActive-dependent styling below lives in the `children` render-prop instead, which Slot
  // passes through untouched.
  const staticClassName = cn(
    'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
    isCollapsed && 'justify-center px-0',
  );

  const link = (
    <NavLink to={href} className={staticClassName}>
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
                layoutId={SIDEBAR_ACTIVE_INDICATOR_LAYOUT_ID}
                className="absolute inset-0 rounded-md border-l-2 border-primary bg-primary/10"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden
              />
            )
          ) : null}
          <Icon className={cn('relative size-4 shrink-0', isActive && 'text-primary')} aria-hidden />
          {isCollapsed ? null : (
            <span className={cn('relative', isActive && 'text-primary')}>{label}</span>
          )}
        </>
      )}
    </NavLink>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export { Sidebar };
