# AI Module

The AI Learning Assistant (Prompt 7): lesson-context-aware chat, explanations, lesson
summaries, worked examples, and practice-question generation, backed by a swappable AI
provider.

## Architecture (Prompt 7 § AI SERVICE)

```
Frontend → ai.controller.ts → ai.service.ts → { prompt-manager, context-builder, AiProvider } → ai.repository.ts
```

- **`ai.controller.ts`** — HTTP handlers only (`chat`, `listHistory`, `getConversation`,
  `deleteHistory`, `deleteConversation`). No business logic.
- **`ai.service.ts`** — the "Conversation Manager". Orchestrates: resolve/create the
  conversation, build the lesson context (if any), build the system prompt, load bounded
  history, persist the user message, call the provider, persist the assistant message. Exports
  a module-level `aiService` singleton, mirroring `notificationsService` (Prompt 6 precedent).
- **`prompt-manager.ts`** — the "Prompt Manager". Every AI feature (CHAT / EXPLAIN_TOPIC /
  SUMMARIZE_LESSON / GENERATE_EXAMPLES / GENERATE_PRACTICE_QUESTIONS) is the _same_ underlying
  chat call — only the system prompt differs, selected here by `feature`
  (+ `explanationLevel` for EXPLAIN_TOPIC's Beginner/Detailed/Interview variants). One pipeline,
  not one bespoke code path per feature.
- **`context-builder.ts`** — builds strict lesson evidence from title/description,
  MARKDOWN/CODE_SNIPPET content, and extracted PDF/DOCX/PPTX text. It also builds the main
  tutor's permitted department/course catalog. Document extraction is cached by resource id and
  `updatedAt` so repeated turns do not repeatedly parse the same file.
- **`providers/ai-provider.interface.ts`** — the swappable vendor seam (Prompt 7 §
  ARCHITECTURE: "Frontend → Backend AI Service → AI Provider → Response"). Everything above
  this line depends on `AiProvider`, never on a concrete vendor or its SDK types.
- **`providers/anthropic.provider.ts`** / **`providers/openai.provider.ts`** — the two
  `AiProvider` implementations; the only files that import `@anthropic-ai/sdk` / `openai`
  directly. Adding a third vendor means writing another sibling class here.
- **`active-provider.ts`** — the one place the active vendor is picked, via `AI_PROVIDER`
  (default `openai`; set to `anthropic` to switch back). Lives in its own file rather than
  `index.ts` so `ai.service.ts` can import the singleton without a circular import through
  `index.ts` (which re-exports `AiService`/`aiService` from `ai.service.ts`).
- **`ai.repository.ts`** — the only class touching Prisma (`AiConversation`/`AiMessage`), plus
  a self-contained `isLessonAccessibleToUser` copy (see below).

## Configuration

`AI_PROVIDER` (default `openai`) picks the active vendor in `active-provider.ts`. Per-vendor
config, both optional (see `src/config/env.ts`):

- OpenAI (active by default): `MAIN_OPENAI_API_KEY`, `MAIN_OPENAI_MODEL` (default
  `gpt-5.3-codex`).
- Anthropic: `ANTHROPIC_API_KEY`, `AI_MODEL_ID` (default `claude-opus-4-8`).

Whichever provider is active constructs its SDK client lazily as `null` when its key is unset,
so the app still boots normally; `POST /ai/chat` (and the lesson-quiz module's quiz generation)
return `503 SERVICE_UNAVAILABLE` with a clear message instead of the whole server failing to
start or a raw SDK error leaking to the client. Once a real key is set, no code change is
needed — just restart the server.

## Data model

`AiConversation` (one chat thread, optionally scoped to a `lessonId` set once at creation) →
`AiMessage` (`role: USER | ASSISTANT`, `feature`, `content`, and `inputTokens`/`outputTokens`
populated on ASSISTANT rows straight from the provider's `usage` block — the "token usage
tracking foundation" required by Prompt 7 § AI SECURITY). Lesson accessibility is re-checked on
EVERY turn, not just at conversation creation, because the context block is rebuilt from the
lesson's LIVE content each time. If a trainee loses access through group removal, unpublish, or
soft-delete, further turns are rejected; a lesson conversation never silently changes into a
general tutor conversation.

## Security (Prompt 7 § AI SECURITY)

- Every route requires `authenticate` — open to all three roles (not trainee-exclusive at the
  API level; the UI surfaces it primarily on the trainee dashboard/lesson viewer).
- `POST /ai/chat` additionally sits behind `aiRateLimiter` (`src/middleware/`), a per-user
  (not per-IP) limiter stricter than the app-wide general limiter — every call is a real,
  billed LLM request.
- A trainee can only attach lesson context for a lesson they're actually assigned (self-contained
  `AiRepository#isLessonAccessibleToUser`, mirroring `LessonsRepository#isAccessibleToUser`'s
  exact rule from Prompt 5).
- Lesson conversations use strict grounding: facts may come only from source-labelled lesson
  description/resource text. Main-tutor conversations are restricted to the learner's department,
  assigned course catalog, and supported technical-learning domains.
- Provider output must be a validated `ANSWER`/`REFUSE` JSON envelope with permitted evidence
  ids. Malformed output, empty answers, or invented ids fail closed to a deterministic refusal;
  the internal envelope is removed before the final Markdown answer is saved or shown.
- Before external provider calls, the system prompt, bounded history, and current message are
  passed through `redactSensitiveText`. It removes high-confidence email/phone/government-id/IP/
  long-number patterns and labelled secrets. The original conversation is retained internally;
  only the outbound copy is redacted. Quiz and dashboard provider calls use the same utility.
- Neither provider surfaces raw SDK error text (API keys, internal error details) to the
  client — every branch logs the real cause via `logger` and returns a generic, safe message.
  Both check for a model refusal before reading response content (Anthropic:
  `stop_reason: "refusal"`; OpenAI: `message.refusal`).
- If the provider call fails on an EXISTING conversation, the trainee's own message is still
  persisted (already saved before the provider call) — their input is never silently lost, and
  they can retry the same conversation once the assistant is available again. A brand-new
  conversation is rolled back on provider failure instead: the error response carries no
  `conversationId`, so the client could never reach it, and retries would otherwise strand
  one-message orphan conversations in the history list.

## Current boundary

The tutor grounds against bounded prompt context rather than vector search/RAG. Very large lesson
libraries may eventually need chunking and retrieval, but the current implementation deliberately
fails closed when the supplied lesson evidence cannot support an answer.
