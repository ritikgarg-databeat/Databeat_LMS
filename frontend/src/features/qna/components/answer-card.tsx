// One answer to a question: author info, markdown content, verified/pinned indicators, a vote
// button, RBAC-gated edit/delete/pin/verify controls, and a nested `CommentThread`.
//
// RBAC (verified live via curl against the backend): the answer's own author OR any
// TRAINER/SUPER_ADMIN may edit/delete it. ONLY TRAINER/SUPER_ADMIN may pin or verify — a
// TRAINEE hitting either endpoint gets a 403 even for their own question's answers.
//
// NOTE: imports `VerifiedBadge` directly from its file (not the `../components` barrel) since
// `components/index.ts` is centrally composed later by the orchestrator and isn't populated yet
// — same direct-file-import pattern already used elsewhere in this codebase (see
// `features/assessment/pages/attempt-grading-page.tsx` importing `'../components/question-type-badge'`).
import { CheckCircle2, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ROLES } from '@/constants/roles';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import {
  useCreateCommentMutation,
  useDeleteAnswerMutation,
  useDeleteCommentMutation,
  usePinAnswerMutation,
  useToggleVoteMutation,
  useUpdateAnswerMutation,
  useVerifyAnswerMutation,
} from '../hooks';
import type { QnaAnswer, QnaQuestionStatus } from '../types';

import { CommentThread } from './comment-thread';
import { VerifiedBadge } from './verified-badge';
import { VoteButton } from './vote-button';

export interface AnswerCardProps {
  answer: QnaAnswer;
  /** The PARENT question's id — used for cache invalidation on every mutation below. */
  questionId: string;
  /**
   * Accepted for interface symmetry with the page's other per-answer props, but intentionally
   * unused here: none of this backend's RBAC/status rules (verified live via curl) gate an
   * EXISTING answer's edit/delete/pin/verify actions on the parent question's status — only
   * posting a brand-new answer is blocked once a question is CLOSED (enforced in
   * `answer-editor.tsx`/`question-detail-page.tsx` instead).
   */
  questionStatus: QnaQuestionStatus;
}

/**
 * Manual replacement for `@tailwindcss/typography`'s `prose` class (not installed in this
 * project) — mirrors `features/classroom/components/lesson-content-renderer.tsx`'s
 * `MARKDOWN_CONTENT_CLASSNAME` so answer/question markdown reads consistently across the app.
 */
const MARKDOWN_CONTENT_CLASSNAME =
  'max-w-none text-sm leading-relaxed text-foreground ' +
  '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 ' +
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0';

function AnswerCard({ answer, questionId }: AnswerCardProps) {
  const { user } = useAuth();
  const isStaff = user?.role === ROLES.TRAINER || user?.role === ROLES.SUPER_ADMIN;
  const isAuthor = user?.id === answer.author.id;
  const canModify = isAuthor || isStaff;

  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(answer.content);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const toggleVote = useToggleVoteMutation();
  const updateAnswer = useUpdateAnswerMutation();
  const deleteAnswer = useDeleteAnswerMutation();
  const pinAnswer = usePinAnswerMutation();
  const verifyAnswer = useVerifyAnswerMutation();
  const createComment = useCreateCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  const handleToggleVote = () => {
    toggleVote.mutate(
      { questionId, payload: { answerId: answer.id } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleStartEdit = () => {
    setDraftContent(answer.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftContent(answer.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const trimmed = draftContent.trim();
    if (!trimmed) return;
    updateAnswer.mutate(
      { id: answer.id, questionId, payload: { content: trimmed } },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('Answer updated.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const handleDelete = () => {
    deleteAnswer.mutate(
      { id: answer.id, questionId },
      {
        onSuccess: () => {
          setConfirmDeleteOpen(false);
          toast.success('Answer deleted.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const handleTogglePin = () => {
    pinAnswer.mutate(
      { id: answer.id, questionId, payload: { isPinned: !answer.isPinned } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleVerify = () => {
    verifyAnswer.mutate(
      { questionId, payload: { answerId: answer.id } },
      {
        onSuccess: () => toast.success('Answer marked as verified.'),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const handleAddComment = (content: string) => {
    createComment.mutate(
      { questionId, payload: { answerId: answer.id, content } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate(
      { id: commentId, questionId },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  return (
    <div id={`answer-${answer.id}`} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {answer.author.firstName} {answer.author.lastName}
        </span>
        {answer.isVerified ? <VerifiedBadge /> : null}
        {answer.isPinned ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pin className="size-3" aria-hidden /> Pinned
          </span>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            rows={5}
            disabled={updateAnswer.isPending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={updateAnswer.isPending || !draftContent.trim()}
            >
              {updateAnswer.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={updateAnswer.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className={MARKDOWN_CONTENT_CLASSNAME}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.content}</ReactMarkdown>
        </div>
      )}

      {answer.isVerified && answer.verifiedBy ? (
        <p className="text-xs text-muted-foreground">
          Verified by {answer.verifiedBy.firstName} {answer.verifiedBy.lastName}
          {answer.verifiedAt ? ` on ${formatDate(answer.verifiedAt)}` : ''}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <VoteButton
          voteCount={answer.voteCount}
          myVote={answer.myVote}
          onToggle={handleToggleVote}
          isPending={toggleVote.isPending}
        />

        {canModify && !isEditing ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleStartEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        ) : null}

        {canModify ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        ) : null}

        {isStaff ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleTogglePin}
            disabled={pinAnswer.isPending}
          >
            {answer.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {answer.isPinned ? 'Unpin' : 'Pin'}
          </Button>
        ) : null}

        {isStaff && !answer.isVerified ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={verifyAnswer.isPending}
          >
            <CheckCircle2 className="size-3.5" /> {verifyAnswer.isPending ? 'Verifying...' : 'Verify'}
          </Button>
        ) : null}
      </div>

      <CommentThread
        comments={answer.comments}
        onSubmit={handleAddComment}
        isSubmitting={createComment.isPending}
        currentUserId={user?.id ?? ''}
        onDelete={handleDeleteComment}
        canDeleteAll={isStaff}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this answer?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

export { AnswerCard };
