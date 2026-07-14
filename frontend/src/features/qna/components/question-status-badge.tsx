import { Badge, type BadgeProps } from '@/components/ui/badge';

import type { QnaQuestionStatus } from '../types';

const STATUS_VARIANT: Record<QnaQuestionStatus, BadgeProps['variant']> = {
  OPEN: 'default',
  SOLVED: 'success',
  CLOSED: 'secondary',
};

const STATUS_LABEL: Record<QnaQuestionStatus, string> = {
  OPEN: 'Open',
  SOLVED: 'Solved',
  CLOSED: 'Closed',
};

export interface QuestionStatusBadgeProps {
  status: QnaQuestionStatus;
  className?: string;
}

/** Small presentational atom — colors a `QnaQuestionStatus` using the shared `<Badge>` variants. */
function QuestionStatusBadge({ status, className }: QuestionStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export { QuestionStatusBadge };
