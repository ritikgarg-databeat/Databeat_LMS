import { motion, useReducedMotion } from 'framer-motion';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { BrandLogo } from '@/components/layout';
import { LoadingScreen } from '@/components/shared';
import { BrandingPanel } from '@/features/auth/components';

/**
 * Split-screen shell for login/forgot-password pages: a brand panel on the left (`lg:` and up
 * only — see BrandingPanel) and the page's own card content (via `<Outlet />`) on the right.
 * Below `lg:` the brand panel is replaced by a compact header banner so the form stays the
 * sole focus on mobile/tablet.
 */
function AuthLayout() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-svh w-full bg-muted/30 lg:grid lg:grid-cols-2">
      <BrandingPanel />

      <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
        {/* Compact mobile/tablet header banner — replaces the branding panel below `lg:`. */}
        <div className="mb-6 lg:hidden">
          <BrandLogo imgClassName="h-9" />
        </div>

        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: shouldReduceMotion ? 0 : 0.15 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
            <div className="h-1.5 w-full bg-primary" />
            <div className="p-6 sm:p-8">
              {/* Scoped to the card body only — see routes/router.tsx for the boundary rationale. */}
              <Suspense fallback={<LoadingScreen fullScreen={false} />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export { AuthLayout };
