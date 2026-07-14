import { Badge, type BadgeProps } from '@/components/ui/badge';

import type { CourseStatus } from '../types';

const STATUS_VARIANT: Record<CourseStatus, BadgeProps['variant']> = {
  DRAFT: 'secondary',
  PUBLISHED: 'success',
  ARCHIVED: 'outline',
};

const STATUS_LABEL: Record<CourseStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export interface CourseStatusBadgeProps {
  status: CourseStatus;
  className?: string;
}

/** Small presentational atom — colors a `CourseStatus` using the shared `<Badge>` variants. */
function CourseStatusBadge({ status, className }: CourseStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export { CourseStatusBadge };
