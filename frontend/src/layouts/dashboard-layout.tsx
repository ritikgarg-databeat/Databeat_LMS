import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import {
  Sidebar,
  MobileNav,
  Header,
  Footer,
  MotivationalMessage,
  type SidebarNavItem,
} from '@/components/layout';
import { LoadingScreen } from '@/components/shared';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/use-auth';
import { useUIStore } from '@/store/ui-store';

export interface DashboardLayoutProps {
  navItems: SidebarNavItem[];
  brand: React.ReactNode;
  /** Rendered in the header's breadcrumb slot; each role layout supplies its own trail. */
  breadcrumbArea?: React.ReactNode;
}

/**
 * Shared shell for the three authenticated areas (Admin/Trainer/Trainee). Role-specific
 * layouts (`admin-layout.tsx`, etc.) configure this with their own nav items and render it —
 * the structure (sidebar + header + content + footer) stays identical across roles.
 */
function DashboardLayout({ navItems, brand, breadcrumbArea }: DashboardLayoutProps) {
  const isMobileNavOpen = useUIStore((state) => state.isMobileNavOpen);
  const openMobileNav = useUIStore((state) => state.openMobileNav);
  const closeMobileNav = useUIStore((state) => state.closeMobileNav);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <Sidebar items={navItems} header={brand} />
      <MobileNav items={navItems} open={isMobileNavOpen} onOpenChange={closeMobileNav} header={brand} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={openMobileNav}
          breadcrumbArea={breadcrumbArea}
          centerArea={
            user ? (
              <MotivationalMessage userId={user.id} role={user.role} loginMarker={user.lastLogin} />
            ) : null
          }
          userLabel={user?.fullName}
          avatarPath={user?.avatar}
          onLogout={() => void handleLogout()}
        />
        <main className="flex flex-1 flex-col overflow-y-auto">
          {/*
           * Suspense lives here (not at the top of the route tree) so only the content area
           * shows a fallback while a route's lazy chunk loads — the sidebar/header/footer chrome
           * around it stays mounted the whole time. All three role shells route through this one
           * component, so this single boundary covers Admin/Trainer/Trainee navigation.
           */}
          <div className="flex-1 p-4 md:p-6">
            <Suspense fallback={<LoadingScreen fullScreen={false} />}>
              <Outlet />
            </Suspense>
          </div>
          {/* Inside the scrollable region (not a sibling of `<main>`) so it flows at the end of
           * each page's actual content instead of staying permanently pinned to the viewport
           * bottom on every page, shrinking the usable content height. */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

export { DashboardLayout };
