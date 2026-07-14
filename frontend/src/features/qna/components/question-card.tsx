import { Eye, MessageSquare, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/utils/date';

import type { QnaQuestionStatus, QnaVisibility } from '../types';

import { QuestionStatusBadge } from './question-status-badge';
import { QuestionVisibilityBadge } from './question-visibility-badge';
import { VerifiedBadge } from './verified-badge';

/**
 * Common subset of fields rendered by this card. `QnaQuestionListItem` (feed page) satisfies this
 * directly; `QnaSearchQuestionResult` (search page) is missing `hasVerifiedAnswer`/`voteCount`/
 * `viewCount` compared to the list item, so those three are optional here and simply omitted from
 * the footer when absent — lets both call sites pass their native type with no cast.
 */
export interface QuestionCardQuestion {
  id: string;
  title: string;
  status: QnaQuestionStatus;
  visibility: QnaVisibility;
  authorName: string;
  tags: string[];
  answersCount: number;
  createdAt: string;
  hasVerifiedAnswer?: boolean;
  voteCount?: number;
  viewCount?: number;
}

export interface QuestionCardProps {
  question: QuestionCardQuestion;
  /** Role-appropriate detail URL, computed once by the parent page (`/trainer/qna/:id` or `/trainee/qna/:id`). */
  detailHref: string;
}

/** One question row in the feed/search results — title links to the detail page. */
function QuestionCard({ question, detailHref }: QuestionCardProps) {
  return (
    <Card className="transition-colors hover:border-primary">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <QuestionStatusBadge status={question.status} />
          <QuestionVisibilityBadge visibility={question.visibility} />
          {question.hasVerifiedAnswer ? <VerifiedBadge /> : null}
        </div>

        <CardTitle className="text-lg">
          <Link to={detailHref} className="hover:underline">
            {question.title}
          </Link>
        </CardTitle>

        {question.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {question.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>Asked by {question.authorName}</span>
        <span>{formatRelativeTime(question.createdAt)}</span>
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden />
          {question.answersCount} answer{question.answersCount === 1 ? '' : 's'}
        </span>
        {typeof question.voteCount === 'number' ? (
          <span className="flex items-center gap-1">
            <ThumbsUp className="size-3.5" aria-hidden />
            {question.voteCount}
          </span>
        ) : null}
        {typeof question.viewCount === 'number' ? (
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" aria-hidden />
            {question.viewCount} views
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { QuestionCard };
