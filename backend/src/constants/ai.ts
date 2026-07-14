/** Length/window limits for the AI Learning Assistant (Prompt 7). */
export const MAX_AI_MESSAGE_LENGTH = 4000;
export const MAX_AI_CONVERSATION_TITLE_LENGTH = 200;

/** How many of the conversation's most recent messages are replayed to the provider as
 * history on each turn — keeps prompt size (and cost) bounded on long-running chats without
 * needing compaction/summarization infrastructure yet. */
export const AI_HISTORY_MESSAGES_INCLUDED = 20;

/** Comfortably above what a multi-paragraph tutoring explanation needs, well under the ~16K
 * threshold where the Anthropic SDK requires streaming to avoid client-side HTTP timeouts —
 * see providers/anthropic.provider.ts. */
export const AI_MAX_RESPONSE_TOKENS = 4096;

/** `GET /ai/conversations/:id` returns at most this many of the MOST RECENT messages — the
 * write path never caps a conversation's length, so the detail fetch (the only place a whole
 * conversation is serialized) needs its own bound to stay a sane query/payload size. */
export const AI_CONVERSATION_MESSAGES_MAX = 200;

/** Lesson text content (concatenated from its MARKDOWN/CODE_SNIPPET resources) is truncated to
 * this many characters before being added to the system prompt — see context-builder.ts. */
export const AI_CONTEXT_MAX_LESSON_CONTENT_CHARS = 6000;

/** Stricter than the app-wide general rate limiter (100 req/15min) — each call is a real,
 * billed LLM request, so /ai/chat gets its own tighter, per-user budget. */
export const AI_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AI_RATE_LIMIT_MAX_REQUESTS = 30;
