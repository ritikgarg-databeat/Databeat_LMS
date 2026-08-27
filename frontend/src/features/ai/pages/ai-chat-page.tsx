// Main AI Learning Assistant chat interface. Mounted at `/trainee/ai-tutor` by the orchestrating
// session. Arrives either fresh (optionally `?lessonId=` from a lesson's "Ask AI" button) or
// resuming a past conversation (`?conversationId=`, e.g. from the history page).
//
// `POST /ai/chat` only ever returns the ASSISTANT's reply, never an echo of the user's own
// message, and it currently 503s in dev (ANTHROPIC_API_KEY unconfigured) — so every send is
// rendered optimistically from local state (see `ChatTurn` below) rather than waiting on/relying
// on a refetch, and a failed send leaves the user's own bubble in place with an inline error
// note instead of disappearing.
import { BookOpen, History, Plus, Send, ShieldCheck, Video as VideoIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import { useLessonQuery } from '@/features/classroom/hooks';
import { getErrorMessage } from '@/utils/error';

import { ChatMessageBubble, SuggestedPrompts, TraineeVideoResponse } from '../components';
import { useAiChatMutation, useAiConversationQuery, useAiVideoMutation } from '../hooks';
import type {
  AiExplanationLevel,
  AiFeature,
  AiMessage,
  AiResponseLanguage,
  AiVideoGeneration,
  ChatResponse,
} from '../types';

const AI_HISTORY_PATH = `${ROUTES.TRAINEE.AI_TUTOR}/history`;
const DEFAULT_VIDEO_REQUEST = 'Create a short explanatory video for this lesson.';

interface ChatTurn {
  /** Locally-generated id for turns sent this session; the seed user message's own id for turns
   * loaded from history. Only used as a React `key` and to target state updates. */
  id: string;
  userContent: string;
  feature: AiFeature;
  explanationLevel: AiExplanationLevel | undefined;
  assistantStatus: 'pending' | 'success' | 'error';
  assistantContent: string;
  video?: AiVideoGeneration;
}

const FEATURE_OPTIONS: { value: AiFeature; label: string }[] = [
  { value: 'CHAT', label: 'Chat' },
  { value: 'EXPLAIN_TOPIC', label: 'Explain topic' },
  { value: 'SUMMARIZE_LESSON', label: 'Summarize lesson' },
  { value: 'GENERATE_EXAMPLES', label: 'Examples' },
  { value: 'GENERATE_PRACTICE_QUESTIONS', label: 'Practice questions' },
  { value: 'GENERATE_VIDEO', label: 'Video' },
];

const EXPLANATION_LEVEL_OPTIONS: { value: AiExplanationLevel; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'DETAILED', label: 'Detailed' },
  { value: 'INTERVIEW', label: 'Interview' },
];

const RESPONSE_LANGUAGES: AiResponseLanguage[] = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Japanese',
];

/**
 * Pairs up a conversation's flat, chronological message list into turns. Normally strictly
 * alternating USER/ASSISTANT, but a trailing USER message with no following ASSISTANT reply is
 * possible (e.g. a previous session's send failed after the user message was persisted but
 * before the provider call resolved) — rendered as an errored turn rather than dropped.
 */
function messagesToTurns(messages: AiMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let i = 0;
  while (i < messages.length) {
    const message = messages[i];
    if (!message) break;
    if (message.role !== 'USER') {
      i += 1;
      continue;
    }
    const next = messages[i + 1];
    if (next && next.role === 'ASSISTANT') {
      turns.push({
        id: message.id,
        userContent: message.content,
        feature: message.feature ?? 'CHAT',
        explanationLevel: undefined,
        assistantStatus: 'success',
        assistantContent: next.content,
        video: next.video,
      });
      i += 2;
    } else {
      turns.push({
        id: message.id,
        userContent: message.content,
        feature: message.feature ?? 'CHAT',
        explanationLevel: undefined,
        assistantStatus: 'error',
        assistantContent: '',
      });
      i += 1;
    }
  }
  return turns;
}

function AiChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('conversationId') ?? undefined;
  const lessonIdParam = searchParams.get('lessonId') ?? undefined;

  const conversationQuery = useAiConversationQuery(conversationId);
  const effectiveLessonId = conversationId ? (conversationQuery.data?.lessonId ?? undefined) : lessonIdParam;
  const { data: contextLesson } = useLessonQuery(effectiveLessonId);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  // Guards the seed-from-history effect below so a background refetch of the conversation query
  // (triggered by this page's own `useAiChatMutation` invalidating it) never clobbers turns the
  // user has already sent this session.
  const seededConversationIdRef = useRef<string | undefined>(undefined);
  // Bumped by `handleNewChat` so callbacks of a send still in flight when the user abandons the
  // chat can detect they are stale and bail (see `sendMessage`) — otherwise a first send's reply
  // would write its new conversationId back into the URL and resurrect the abandoned chat.
  const chatSessionRef = useRef(0);

  useEffect(() => {
    const conversation = conversationQuery.data;
    if (!conversation || seededConversationIdRef.current === conversation.id) return;
    seededConversationIdRef.current = conversation.id;
    setTurns(messagesToTurns(conversation.messages));
  }, [conversationQuery.data]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A single instance is fine here: every call to `mutate` below is submit/click-driven from
  // this one component, never fired from an effect — the StrictMode double-invoke pitfall that
  // requires separate instances (see `lesson-viewer-page.tsx`) doesn't apply.
  const chatMutation = useAiChatMutation();
  const videoMutation = useAiVideoMutation();
  const [feature, setFeature] = useState<AiFeature>('CHAT');
  const [explanationLevel, setExplanationLevel] = useState<AiExplanationLevel | undefined>(undefined);
  const [responseLanguage, setResponseLanguage] = useState<AiResponseLanguage>('English');
  const [inputValue, setInputValue] = useState('');
  const effectiveFeature: AiFeature =
    !effectiveLessonId && (feature === 'GENERATE_VIDEO' || feature === 'SUMMARIZE_LESSON') ? 'CHAT' : feature;

  function sendMessage(
    rawText: string,
    sendFeature: AiFeature,
    sendExplanationLevel: AiExplanationLevel | undefined,
  ) {
    const trimmed = rawText.trim();
    const userContent = sendFeature === 'GENERATE_VIDEO' && !trimmed ? DEFAULT_VIDEO_REQUEST : trimmed;
    const isSending = chatMutation.isPending || videoMutation.isPending;
    if (!userContent || isSending) return;
    if (sendFeature === 'GENERATE_VIDEO' && !effectiveLessonId) {
      toast.error('Attach a lesson before creating a video.');
      return;
    }

    const sessionAtSend = chatSessionRef.current;
    const turnId = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        userContent,
        feature: sendFeature,
        explanationLevel: sendExplanationLevel,
        assistantStatus: 'pending',
        assistantContent: '',
      },
    ]);

    const callbacks = {
      onSuccess: (data: ChatResponse) => {
        // The user hit "New chat" while this request was in flight — the reply belongs to an
        // abandoned chat, so leave the fresh chat's turns and URL alone.
        if (sessionAtSend !== chatSessionRef.current) return;
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  assistantStatus: 'success' as const,
                  assistantContent: data.message.content,
                  video: data.message.video,
                }
              : turn,
          ),
        );
        if (!conversationId) {
          // Mark the just-created conversation as already seeded BEFORE the URL write enables
          // its detail query — otherwise the seed effect would clobber the live local turns
          // (e.g. one sent or regenerated while this reply was in flight) with the fetched
          // snapshot. Seeding is only for opening an existing conversation from history.
          seededConversationIdRef.current = data.conversationId;
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('conversationId', data.conversationId);
              return next;
            },
            { replace: true },
          );
        }
      },
      onError: (error: Error) => {
        if (sessionAtSend !== chatSessionRef.current) return;
        setTurns((prev) =>
          prev.map((turn) => (turn.id === turnId ? { ...turn, assistantStatus: 'error' } : turn)),
        );
        toast.error(getErrorMessage(error));
      },
    };

    if (sendFeature === 'GENERATE_VIDEO') {
      videoMutation.mutate(
        {
          conversationId,
          lessonId: !conversationId ? lessonIdParam : undefined,
          message: trimmed || undefined,
        },
        callbacks,
      );
    } else {
      chatMutation.mutate(
        {
          conversationId,
          lessonId: !conversationId ? lessonIdParam : undefined,
          message: trimmed,
          feature: sendFeature,
          explanationLevel: sendExplanationLevel,
          responseLanguage,
        },
        callbacks,
      );
    }
  }

  function handleSend() {
    if (
      (!inputValue.trim() && effectiveFeature !== 'GENERATE_VIDEO') ||
      chatMutation.isPending ||
      videoMutation.isPending
    )
      return;
    sendMessage(inputValue, effectiveFeature, explanationLevel);
    setInputValue('');
  }

  function handleSuggestedPromptSelect(
    selectedFeature: AiFeature,
    selectedExplanationLevel: AiExplanationLevel | undefined,
    promptText: string,
  ) {
    setFeature(selectedFeature);
    setExplanationLevel(selectedExplanationLevel);
    if (!promptText) {
      textareaRef.current?.focus();
      return;
    }
    sendMessage(promptText, selectedFeature, selectedExplanationLevel);
  }

  // Client-side approximation of "regenerate": the backend has no endpoint to replace/re-run the
  // last response, so this just re-sends the same user text as a brand-new message in the same
  // conversation, appending a fresh assistant reply after the existing one.
  function handleRegenerate(turn: ChatTurn) {
    sendMessage(turn.userContent, turn.feature, turn.explanationLevel);
  }

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function handleNewChat() {
    chatSessionRef.current += 1; // neutralize any in-flight send's callbacks (see `sendMessage`)
    setTurns([]);
    seededConversationIdRef.current = undefined;
    setFeature('CHAT');
    setExplanationLevel(undefined);
    setResponseLanguage('English');
    setInputValue('');
    setSearchParams({}, { replace: true });
  }

  if (conversationId && conversationQuery.isError) {
    return (
      <ErrorScreen
        title="Unable to load this conversation"
        message={getErrorMessage(conversationQuery.error)}
        onRetry={() => void conversationQuery.refetch()}
      />
    );
  }

  const isInitialConversationLoading =
    Boolean(conversationId) && conversationQuery.isLoading && turns.length === 0;
  const visibleFeatureOptions = effectiveLessonId
    ? FEATURE_OPTIONS
    : FEATURE_OPTIONS.filter(
        (option) => option.value !== 'SUMMARIZE_LESSON' && option.value !== 'GENERATE_VIDEO',
      );
  const isSending = chatMutation.isPending || videoMutation.isPending;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">AI Learning Assistant</h1>
          {effectiveLessonId ? (
            <Badge variant="secondary" className="gap-1.5">
              <BookOpen className="size-3.5" />
              {contextLesson?.title ?? 'Lesson-scoped conversation'}
            </Badge>
          ) : null}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            {effectiveLessonId
              ? 'Answers are restricted to this lesson and its provided materials.'
              : 'Answers are restricted to your department, assigned courses, and learning topics.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(AI_HISTORY_PATH)}>
            <History className="size-4" /> History
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleNewChat}>
            <Plus className="size-4" /> New chat
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 rounded-lg border">
        <div className="space-y-4 p-4">
          {isInitialConversationLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : turns.length === 0 ? (
            <SuggestedPrompts
              onSelect={handleSuggestedPromptSelect}
              hasLessonContext={Boolean(effectiveLessonId)}
            />
          ) : (
            turns.map((turn, index) => {
              const isLast = index === turns.length - 1;
              return (
                <div key={turn.id} className="space-y-2">
                  <ChatMessageBubble sender="user" content={turn.userContent} />
                  {turn.video && turn.assistantStatus === 'success' ? (
                    <TraineeVideoResponse initialVideo={turn.video} />
                  ) : (
                    <ChatMessageBubble
                      sender="assistant"
                      content={turn.assistantContent}
                      isPending={turn.assistantStatus === 'pending'}
                      isError={turn.assistantStatus === 'error'}
                      onCopy={() => void handleCopy(turn.assistantContent)}
                      onRegenerate={() => handleRegenerate(turn)}
                      showRegenerate={isLast && turn.assistantStatus === 'success' && !isSending}
                    />
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleFeatureOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={effectiveFeature === option.value ? 'default' : 'outline'}
              onClick={() => {
                setFeature(option.value);
                if (option.value === 'EXPLAIN_TOPIC' && !explanationLevel) setExplanationLevel('BEGINNER');
              }}
            >
              {option.label}
            </Button>
          ))}
          <Select
            value={responseLanguage}
            onValueChange={(value) => setResponseLanguage(value as AiResponseLanguage)}
          >
            <SelectTrigger className="ml-auto w-36" aria-label="Answer language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_LANGUAGES.map((language) => (
                <SelectItem key={language} value={language}>
                  {language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {effectiveFeature === 'EXPLAIN_TOPIC' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {EXPLANATION_LEVEL_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={explanationLevel === option.value ? 'default' : 'outline'}
                onClick={() => setExplanationLevel(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              effectiveFeature === 'GENERATE_VIDEO'
                ? 'Optional: describe what this short lesson video should focus on...'
                : effectiveLessonId
                  ? 'Ask a question about this lesson...'
                  : 'Ask about your courses or learning topics...'
            }
            rows={2}
            maxLength={effectiveFeature === 'GENERATE_VIDEO' ? 2000 : undefined}
            className="resize-none"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || (!inputValue.trim() && effectiveFeature !== 'GENERATE_VIDEO')}
          >
            {effectiveFeature === 'GENERATE_VIDEO' ? (
              <VideoIcon className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {effectiveFeature === 'GENERATE_VIDEO' ? 'Create video' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { AiChatPage };
