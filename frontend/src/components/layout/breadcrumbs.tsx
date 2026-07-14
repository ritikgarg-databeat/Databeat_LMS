import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbEntry[];
}

/** Renders the current page's location trail; mounted in the layout's breadcrumb area. */
function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <Breadcrumb>
      {/*
       * The shared `BreadcrumbList` primitive defaults to `flex-wrap`, which is fine in a
       * free-flowing page body but breaks the header's fixed `h-14` row on narrow/tablet
       * widths — a long trail wraps to a second line and gets clipped instead of the row
       * growing. Overriding to `flex-nowrap` + horizontal scroll keeps the header a single
       * row at every width; `cn`'s tailwind-merge resolves the `flex-wrap`/`flex-nowrap`
       * conflict in favor of this className (see `lib/utils.ts#cn`).
       */}
      <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={item.label}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export { Breadcrumbs };
