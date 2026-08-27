// Reusable comment list + reply box. Used for BOTH a question's own top-level comments
// (`question.comments`) and an individual answer's comments (`answer.comments`) — the parent
// (question-detail-page / answer-card) owns which mutation variables an add/delete actually
// sends (a comment targets exactly one of `questionId`/`answerId`), so this component stays
// dumb: it just renders comments and forwards submit/delete intents upward.
import { Send, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/utils/date';

import type { QnaComment } from '../types';

export interface CommentThreadProps {
  comments: QnaComment[];
  onSubmit: (content: string) => void;
  isSubmitting: boolean;
  currentUserId: string;
  onDelete: (commentId: string) => void;
  /** Staff (TRAINER/SUPER_ADMIN) may delete ANY comment, not just their own — set by the parent. */
  canDeleteAll?: boolean;
}

/** Comments are lightweight clarifying remarks — rendered compactly, smaller than an answer. */
function CommentThread({
  comments,
  onSubmit,
  isSubmitting,
  currentUserId,
  onDelete,
  canDeleteAll = false,
}: CommentThreadProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    onSubmit(content);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      {comments.length > 0 ? (
        <ul className="space-y-1.5">
          {comments.map((comment) => {
            const canDelete = canDeleteAll || comment.author.id === currentUserId;
            return (
              <li
                key={comment.id}
                className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                <p className="leading-relaxed">
                  <span className="font-medium text-foreground">
                    {comment.author.firstName} {comment.author.lastName}
                  </span>{' '}
                  {comment.content}{' '}
                  <span className="whitespace-nowrap">· {formatRelativeTime(comment.createdAt)}</span>
                </p>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(comment.id)}
                    aria-label="Delete comment"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a comment..."
          disabled={isSubmitting}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={isSubmitting || !draft.trim()}>
          <Send className="size-3.5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

export { CommentThread };
