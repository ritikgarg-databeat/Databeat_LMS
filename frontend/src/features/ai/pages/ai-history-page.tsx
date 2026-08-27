// Paginated list of the current user's past AI Learning Assistant conversations. Mounted by the
// orchestrating session, likely at `/trainee/ai-tutor/history`.
import { MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, EmptyState, ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatRelativeTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { useAiHistoryQuery, useClearAiHistoryMutation, useDeleteAiConversationMutation } from '../hooks';
import type { AiConversationListItem } from '../types';

const AI_HISTORY_PAGE_SIZE = 20;
const AI_TUTOR_PATH = ROUTES.TRAINEE.AI_TUTOR;

function AiHistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [deletingConversation, setDeletingConversation] = useState<AiConversationListItem | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useAiHistoryQuery({
    page,
    pageSize: AI_HISTORY_PAGE_SIZE,
  });
  const deleteConversation = useDeleteAiConversationMutation();
  const clearHistory = useClearAiHistoryMutation();

  // Clamp `page` back into range when a delete leaves the current page past the end of the list
  // (the refetch returns zero items but a nonzero total, e.g. deleting the only conversation on
  // page 2) — otherwise the empty-state branch below renders a false "No conversations yet".
  // Adjusted during render (not in an effect); `page` strictly decreases so this cannot loop.
  if (data && data.items.length === 0 && data.meta.total > 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize));
    setPage(Math.min(lastPage, page - 1));
  }

  if (isError) {
    return (
      <ErrorScreen
        title="Unable to load your AI conversation history"
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const conversations = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  const handleDelete = async () => {
    if (!deletingConversation) return;
    try {
      await deleteConversation.mutateAsync(deletingConversation.id);
      toast.success('Conversation deleted.');
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    } finally {
      setDeletingConversation(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearHistory.mutateAsync();
      toast.success('All AI conversations deleted.');
    } catch (clearError) {
      toast.error(getErrorMessage(clearError));
    } finally {
      setClearAllOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Conversation History</h1>
          <p className="text-muted-foreground">
            Review and continue your past conversations with the AI Learning Assistant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(AI_TUTOR_PATH)}>
            <MessageSquare /> New chat
          </Button>
          {conversations.length > 0 ? (
            <Button
              variant="destructive"
              onClick={() => setClearAllOpen(true)}
              disabled={clearHistory.isPending}
            >
              <Trash2 /> Clear all history
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Start a conversation with the AI Learning Assistant to see it here."
          action={<Button onClick={() => navigate(AI_TUTOR_PATH)}>Start chatting</Button>}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`${AI_TUTOR_PATH}?conversationId=${conversation.id}`)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{conversation.title}</p>
                      {conversation.lesson ? (
                        <Badge variant="secondary">{conversation.lesson.title}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conversation._count.messages} message{conversation._count.messages === 1 ? '' : 's'} ·
                      Updated {formatRelativeTime(conversation.updatedAt)}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete conversation "${conversation.title}"`}
                    onClick={() => setDeletingConversation(conversation)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={page <= 1}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground">
                  Page {data?.meta.page ?? page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={!data || page * AI_HISTORY_PAGE_SIZE >= data.meta.total}
                  className={
                    !data || page * AI_HISTORY_PAGE_SIZE >= data.meta.total
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}

      <ConfirmDialog
        open={deletingConversation !== null}
        onOpenChange={(open) => !open && setDeletingConversation(null)}
        title="Delete conversation"
        description={`"${deletingConversation?.title}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={clearAllOpen}
        onOpenChange={setClearAllOpen}
        title="Clear all history"
        description={`This will permanently delete all ${data?.meta.total ?? 0} of your AI conversations. This cannot be undone.`}
        confirmLabel="Clear all"
        destructive
        onConfirm={() => void handleClearAll()}
      />
    </div>
  );
}

export { AiHistoryPage };
