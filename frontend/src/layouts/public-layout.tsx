import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';

import { BrandLogo, Footer } from '@/components/layout';
import { LoadingScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/** Minimal shell for unauthenticated, public-facing pages (landing, 403, 404). */
function PublicLayout() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
        <Link to={ROUTES.HOME} className="transition-opacity hover:opacity-80">
          <BrandLogo imgClassName="h-9" />
        </Link>
        <Button asChild size="sm">
          <Link to={ROUTES.LOGIN}>Sign In</Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col">
        {/* Boundary scoped to the content area only, so the header/footer chrome above never
         * unmounts while a lazy-loaded page's chunk is fetched — see routes/router.tsx. */}
        <Suspense fallback={<LoadingScreen fullScreen={false} />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export { PublicLayout };
