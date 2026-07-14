// StackOverflow-style question detail page — mounted at `/trainer/qna/:id` and `/trainee/qna/:id`
// (same component for both, per the orchestrator's routing plan). Renders: header
// (title/status/visibility/author/tags with RBAC-gated edit/delete/status controls), the markdown
// description, a vote button, attachments, the question's own top-level comments, the answers
// list (pre-sorted server-side — pinned, then verified, then oldest), and an answer editor.
//
// TODO(orchestrator): point "Back to questions" at the real feed route once
// question-feed-page.tsx is wired into routes/router.tsx (no `ROUTES.*.QNA` key exists yet).
//
// NOTE: `QuestionStatusBadge`/`QuestionVisibilityBadge` are imported directly from their files
// (not the `../components` barrel) since `components/index.ts` is centrally composed later by
// the orchestrator and isn't populated yet — same direct-file-import pattern used elsewhere in
// this codebase (see `features/assessment/pages/attempt-grading-page.tsx`).
import { ChevronLeft, Pencil, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { ConfirmDialog, ErrorScreen, LoadingScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLES } from '@/constants/roles';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { AnswerCard } from '../components/answer-card';
import { AnswerEditor } from '../components/answer-editor';
import { AttachmentList } from '../components/attachment-list';
import { CommentThread } from '../components/comment-thread';
import { QuestionStatusBadge } from '../components/question-status-badge';
import { QuestionVisibilityBadge } from '../components/question-visibility-badge';
import { VoteButton } from '../components/vote-button';
import {
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useDeleteQuestionMutation,
  useQnaQuestionQuery,
  useRemoveAttachmentMutation,
  useToggleVoteMutation,
  useUpdateQuestionMutation,
  useUpdateQuestionStatusMutation,
  useUploadAttachmentMutation,
} from '../hooks';
import type { QnaQuestionStatus } from '../types';

const STATUS_OPTIONS: QnaQuestionStatus[] = ['OPEN', 'SOLVED', 'CLOSED'];

/**
 * Manual replacement for `@tailwindcss/typography`'s `prose` class (not installed in this
 * project) — mirrors `features/classroom/components/lesson-content-renderer.tsx`'s
 * `MARKDOWN_CONTENT_CLASSNAME` so question/answer markdown reads consistently across the app.
 */
const MARKDOWN_CONTENT_CLASSNAME =
  'max-w-none text-sm leading-relaxed text-foreground ' +
  '[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 ' +
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0';

function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = useLocation().pathname.startsWith('/trainer') ? '/trainer' : '/trainee';

  const { data: question, isLoading, isError, error, refetch } = useQnaQuestionQuery(id);

  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleVote = useToggleVoteMutation();
  const updateQuestion = useUpdateQuestionMutation();
  const deleteQuestion = useDeleteQuestionMutation();
  const updateStatus = useUpdateQuestionStatusMutation();
  const uploadAttachment = useUploadAttachmentMutation();
  const removeAttachment = useRemoveAttachmentMutation();
  const createComment = useCreateCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  if (!id) return null;

  if (isError) {
    return (
      <ErrorScreen
        title="Unable to load this question"
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !question) {
    return <LoadingScreen message="Loading question..." fullScreen={false} />;
  }

  const isStaff = user?.role === ROLES.TRAINER || user?.role === ROLES.SUPER_ADMIN;
  const isAuthor = user?.id === question.author.id;
  const canModify = isAuthor || isStaff;
  const isClosed = question.status === 'CLOSED';

  const handleStartEdit = () => {
    setDraftTitle(question.title);
    setDraftDescription(question.description);
    setIsEditingQuestion(true);
  };

  const handleCancelEdit = () => setIsEditingQuestion(false);

  const handleSaveEdit = () => {
    const title = draftTitle.trim();
    const description = draftDescription.trim();
    if (!title || !description) return;
    updateQuestion.mutate(
      { id: question.id, payload: { title, description } },
      {
        onSuccess: () => {
          setIsEditingQuestion(false);
          toast.success('Question updated.');
        },
        onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
      },
    );
  };

  const handleDelete = () => {
    deleteQuestion.mutate(question.id, {
      onSuccess: () => {
        toast.success('Question deleted.');
        navigate(`${basePath}/qna`);
      },
      onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
    });
  };

  const handleStatusChange = (value: string) => {
    updateStatus.mutate(
      { id: question.id, payload: { status: value as QnaQuestionStatus } },
      { onError: (mutationError) => toast.error(getErrorMessage(mutationError)) },
    );
  };

  const handleToggleVote = () => {
    toggleVote.mutate(
      { questionId: question.id, payload: { questionId: question.id } },
      { onError: (mutationError) => toast.error(getErrorMessage(mutationError)) },
    );
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    uploadAttachment.mutate(
      { questionId: question.id, file },
      {
        onSuccess: () => toast.success('Attachment uploaded.'),
        onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
      },
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    removeAttachment.mutate(
      { questionId: question.id, attachmentId },
      {
        onSuccess: () => toast.success('Attachment removed.'),
        onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
      },
    );
  };

  const handleAddComment = (content: string) => {
    createComment.mutate(
      { questionId: question.id, payload: { questionId: question.id, content } },
      { onError: (mutationError) => toast.error(getErrorMessage(mutationError)) },
    );
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate(
      { id: commentId, questionId: question.id },
      { onError: (mutationError) => toast.error(getErrorMessage(mutationError)) },
    );
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to={`${basePath}/qna`}>
          <ChevronLeft /> Back to questions
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {isEditingQuestion ? (
              <Input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="text-lg font-semibold"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">{question.title}</h1>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <QuestionStatusBadge status={question.status} />
              <QuestionVisibilityBadge visibility={question.visibility} />
              <span>
                Asked by {question.author.firstName} {question.author.lastName}
              </span>
              <span>· {question.viewCount} views</span>
              <span>· {formatDate(question.createdAt)}</span>
            </div>

            {question.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {question.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {canModify ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Select value={question.status} onValueChange={handleStatusChange} disabled={updateStatus.isPending}>
                <SelectTrigger className="h-8 w-auto min-w-28 text-xs" aria-label="Change question status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isEditingQuestion ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleStartEdit}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          ) : null}
        </div>

        {isEditingQuestion ? (
          <div className="space-y-2">
            <Textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              rows={8}
              disabled={updateQuestion.isPending}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateQuestion.isPending || !draftTitle.trim() || !draftDescription.trim()}
              >
                {updateQuestion.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit} disabled={updateQuestion.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className={MARKDOWN_CONTENT_CLASSNAME}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.description}</ReactMarkdown>
          </div>
        )}

        <VoteButton
          voteCount={question.voteCount}
          myVote={question.myVote}
          onToggle={handleToggleVote}
          isPending={toggleVote.isPending}
        />
      </div>

      {question.attachments.length > 0 || isAuthor ? (
        <div className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-semibold">Attachments</h2>
          <AttachmentList
            attachments={question.attachments}
            questionId={question.id}
            canRemove={isAuthor}
            onRemove={isAuthor ? handleRemoveAttachment : undefined}
          />
          {isAuthor ? (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAttachment.isPending}
              >
                <Upload className="size-3.5" /> {uploadAttachment.isPending ? 'Uploading...' : 'Attach a file'}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Comments</h2>
        <CommentThread
          comments={question.comments}
          onSubmit={handleAddComment}
          isSubmitting={createComment.isPending}
          currentUserId={user?.id ?? ''}
          onDelete={handleDeleteComment}
          canDeleteAll={isStaff}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <h2 className="text-lg font-semibold">
          {question.answers.length} Answer{question.answers.length === 1 ? '' : 's'}
        </h2>
        {question.answers.map((answer) => (
          <AnswerCard key={answer.id} answer={answer} questionId={question.id} questionStatus={question.status} />
        ))}
      </div>

      <div className="border-t pt-4">
        {isClosed ? (
          <p className="text-sm text-muted-foreground">
            This question is closed and no longer accepting new answers.
          </p>
        ) : (
          <AnswerEditor questionId={question.id} />
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this question?"
        description="This action cannot be undone and will remove all of its answers and comments."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

export { QuestionDetailPage };
