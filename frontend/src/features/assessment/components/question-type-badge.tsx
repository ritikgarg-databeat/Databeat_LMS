import type { LucideIcon } from 'lucide-react';
import { AlignLeft, CheckSquare, CircleDot, Code2, Database, FileUp, ListChecks, MessageSquare, PenLine } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { QuestionType } from '../types';

/**
 * Short, readable label for each `QuestionType`. Exported as the single source of truth so the
 * question bank's filter bar and the create/edit dialogs' type `<select>` build their option
 * lists from the same data (kept in this file since it's the canonical `QuestionType` glossary).
 */
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CORRECT_MCQ: 'Single Correct MCQ',
  MULTIPLE_CORRECT: 'Multiple Correct',
  TRUE_FALSE: 'True / False',
  FILL_IN_THE_BLANK: 'Fill in the Blank',
  SHORT_ANSWER: 'Short Answer',
  LONG_ANSWER: 'Long Answer',
  SQL_QUERY: 'SQL Query',
  CODE_SNIPPET: 'Code Snippet',
  FILE_UPLOAD: 'File Upload',
};

/** Every `QuestionType` value, in the display order used throughout the question bank UI. */
export const QUESTION_TYPE_VALUES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[];

const QUESTION_TYPE_ICON: Record<QuestionType, LucideIcon> = {
  SINGLE_CORRECT_MCQ: CircleDot,
  MULTIPLE_CORRECT: CheckSquare,
  TRUE_FALSE: ListChecks,
  FILL_IN_THE_BLANK: PenLine,
  SHORT_ANSWER: MessageSquare,
  LONG_ANSWER: AlignLeft,
  SQL_QUERY: Database,
  CODE_SNIPPET: Code2,
  FILE_UPLOAD: FileUp,
};

export interface QuestionTypeBadgeProps {
  type: QuestionType;
  className?: string;
  variant?: BadgeProps['variant'];
}

/** Small presentational atom — maps a `QuestionType` to a short label + representative `lucide-react` icon. */
function QuestionTypeBadge({ type, className, variant = 'outline' }: QuestionTypeBadgeProps) {
  const Icon = QUESTION_TYPE_ICON[type];
  return (
    <Badge variant={variant} className={cn('gap-1 font-normal', className)}>
      <Icon className="size-3" aria-hidden />
      {QUESTION_TYPE_LABEL[type]}
    </Badge>
  );
}

export { QuestionTypeBadge };
