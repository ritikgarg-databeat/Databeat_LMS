import { Link } from 'react-router-dom';

import { ROUTES } from '@/constants/routes';

/** Public-site footer — wordmark, one-line description, placeholder links, and copyright. */
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={ROUTES.HOME} className="text-sm font-semibold transition-colors hover:text-primary">
            Databeat LMS
          </Link>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            AI-powered learning management for modern training teams.
          </p>
        </div>

        <nav className="flex items-center gap-6 text-xs text-muted-foreground" aria-label="Footer">
          <Link to="#" className="transition-colors hover:text-primary">
            Contact
          </Link>
          <Link to="#" className="transition-colors hover:text-primary">
            Privacy
          </Link>
        </nav>
      </div>

      <p className="mx-auto mt-6 max-w-6xl text-xs text-muted-foreground">
        &copy; {year} Databeat LMS. All rights reserved.
      </p>
    </footer>
  );
}

export { Footer };
