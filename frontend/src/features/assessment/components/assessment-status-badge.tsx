import { Badge, type BadgeProps } from '@/components/ui/badge';

import type { AssessmentStatus } from '../types';

const STATUS_VARIANT: Record<AssessmentStatus, BadgeProps['variant']> = {
  DRAFT: 'secondary',
  PUBLISHED: 'success',
  ARCHIVED: 'outline',
};

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export interface AssessmentStatusBadgeProps {
  status: AssessmentStatus;
  className?: string;
}

/** Small presentational atom — colors an `AssessmentStatus` using the shared `<Badge>` variants. */
function AssessmentStatusBadge({ status, className }: AssessmentStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export { AssessmentStatusBadge };
