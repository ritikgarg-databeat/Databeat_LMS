import { BadgeCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface VerifiedBadgeProps {
  className?: string;
}

/**
 * Generic "has a verified answer" pill. Deliberately prop-minimal so it composes cleanly both on
 * `QuestionCard` (marking a whole question as having a verified answer) and on the individual
 * answer components built by the parallel agent on `question-detail-page.tsx` (marking one
 * specific answer as verified).
 */
function VerifiedBadge({ className }: VerifiedBadgeProps) {
  return (
    <Badge variant="success" className={cn('gap-1 font-normal', className)}>
      <BadgeCheck className="size-3.5" aria-hidden />
      Verified
    </Badge>
  );
}

export { VerifiedBadge };
