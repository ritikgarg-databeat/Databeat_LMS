// Small upvote-style toggle button, reused for both a question's own vote and any answer's
// vote. Votes are a TOGGLE server-side (clicking again while `myVote` is true removes the
// vote) — the PARENT owns the `useToggleVoteMutation()` call and wires `onToggle` to the
// correct `{questionId}`/`{answerId}` target; this component only renders the current state.
import { ThumbsUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VoteButtonProps {
  voteCount: number;
  myVote: boolean;
  onToggle: () => void;
  isPending?: boolean;
}

function VoteButton({ voteCount, myVote, onToggle, isPending = false }: VoteButtonProps) {
  return (
    <Button
      type="button"
      variant={myVote ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      disabled={isPending}
      aria-pressed={myVote}
      className="gap-1.5"
    >
      <ThumbsUp className={cn('size-4', myVote && 'fill-current')} aria-hidden />
      {voteCount}
    </Button>
  );
}

export { VoteButton };
