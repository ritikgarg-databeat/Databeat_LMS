import { Building2, Globe, type LucideIcon, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { QnaVisibility } from '../types';

interface VisibilityMeta {
  label: string;
  icon: LucideIcon;
}

const VISIBILITY_META: Record<QnaVisibility, VisibilityMeta> = {
  GROUP: { label: 'Group', icon: Users },
  DEPARTMENT: { label: 'Department', icon: Building2 },
  ORGANIZATION: { label: 'Organization', icon: Globe },
};

export interface QuestionVisibilityBadgeProps {
  visibility: QnaVisibility;
  className?: string;
}

/** Small presentational atom — labels a question's `QnaVisibility` with a matching icon. */
function QuestionVisibilityBadge({ visibility, className }: QuestionVisibilityBadgeProps) {
  const meta = VISIBILITY_META[visibility];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-normal', className)}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </Badge>
  );
}

export { QuestionVisibilityBadge };
