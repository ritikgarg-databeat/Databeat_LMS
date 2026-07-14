// A single chat turn's message bubble — either the user's own text (plain, right-aligned) or the
// assistant's reply (markdown-rendered, left-aligned), with a `pending`/`error` presentation for
// the assistant slot while a send is in flight or has failed. Copy/regenerate affordances only
// ever apply to a resolved assistant reply.
import { Copy, RotateCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ChatMessageBubbleProps {
  // Named `sender` rather than `role` so the DOM/ARIA `role` attribute lint rule
  // (`jsx-a11y/aria-role`, which checks any JSX attribute literally named `role` regardless of
  // component) doesn't misfire on this unrelated domain prop.
  sender: 'user' | 'assistant';
  content: string;
  /** Assistant slot only: the reply is still being generated — renders a "thinking" indicator. */
  isPending?: boolean;
  /** Assistant slot only: the send failed — renders an inline error note instead of `content`. */
  isError?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  /** Only the LAST assistant bubble in a conversation should offer regenerate. */
  showRegenerate?: boolean;
}

function ChatMessageBubble({
  sender,
  content,
  isPending = false,
  isError = false,
  onCopy,
  onRegenerate,
  showRegenerate = false,
}: ChatMessageBubbleProps) {
  const isUser = sender === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {isPending ? (
          <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3">
            <span
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: '-0.3s' }}
            />
            <span
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: '-0.15s' }}
            />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Failed to get a response — try again.
          </p>
        ) : (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className={ASSISTANT_MARKDOWN_CLASSNAME}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {!isUser && !isPending && !isError ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onCopy}
              aria-label="Copy response"
            >
              <Copy className="size-3.5" />
            </Button>
            {showRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onRegenerate}
                aria-label="Regenerate response"
              >
                <RotateCw className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Compact counterpart to `lesson-content-renderer.tsx`'s `MARKDOWN_CONTENT_CLASSNAME` — same
 * "manual `prose` replacement" approach, tuned for a narrow chat bubble instead of a full-width
 * lesson page (smaller headings, tighter margins).
 */
const ASSISTANT_MARKDOWN_CLASSNAME =
  'max-w-none text-sm leading-relaxed ' +
  '[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1:first-child]:mt-0 ' +
  '[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 ' +
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3:first-child]:mt-0 ' +
  '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
  '[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic ' +
  '[&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/60 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left ' +
  '[&_td]:border [&_td]:border-border [&_td]:p-1.5';

export { ChatMessageBubble };
