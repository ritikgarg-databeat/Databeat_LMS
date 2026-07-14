import { Badge, type BadgeProps } from '@/components/ui/badge';

import type { CourseDifficulty } from '../types';

const DIFFICULTY_VARIANT: Record<CourseDifficulty, BadgeProps['variant']> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'warning',
  ADVANCED: 'destructive',
};

const DIFFICULTY_LABEL: Record<CourseDifficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export interface DifficultyBadgeProps {
  difficulty: CourseDifficulty;
  className?: string;
}

/** Small presentational atom — colors a `CourseDifficulty` using the shared `<Badge>` variants. */
function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  return (
    <Badge variant={DIFFICULTY_VARIANT[difficulty]} className={className}>
      {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  );
}

export { DifficultyBadge };
