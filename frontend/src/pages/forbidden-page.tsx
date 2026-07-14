import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/** 403 — authenticated but not authorized for the route. Used by the (future) route guard. */
function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="size-12 text-destructive" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
      </div>
      <Button asChild>
        <Link to={ROUTES.HOME}>Back to home</Link>
      </Button>
    </div>
  );
}

export { ForbiddenPage };
