# AI Workflow

Databeat LMS routes every model call through one swappable provider interface:

```text
Frontend -> backend feature service -> prompt/context policy -> outbound redaction
         -> AI provider -> response validation/fallback
```

`AI_PROVIDER` selects `openai` (default) or `anthropic`. Only the concrete provider adapters
import vendor SDKs; tutor, completion-quiz, and dashboard code depend on `AiProvider`.

## AI Learning Assistant

`POST /api/v1/ai/chat` supports chat, topic explanation, lesson summary, examples, and practice
questions. `AiService`:

1. Resolves or creates the authenticated user's conversation.
2. Rechecks lesson access on every turn for a lesson-scoped conversation.
3. Builds either strict lesson evidence or the user's permitted learning catalog.
4. Adds the requested feature behavior and the guarded JSON response contract.
5. Replays only bounded recent conversation history.
6. Redacts common personal identifiers and labelled credentials from the outbound copy.
7. Calls the configured provider and records provider token usage.
8. Validates the decision, answer, and evidence ids before storing learner-visible Markdown.

### Lesson-scoped Ask AI

The lesson entry point supplies `lessonId` when the conversation is created. Live context is
rebuilt on every turn from:

- course, module, and lesson titles as scope metadata;
- the lesson description;
- Markdown and code resource content;
- extracted PDF, DOCX, and PPTX text;
- metadata for resources that cannot be read as text.

Document extraction is shared with the completion-quiz generator and cached in process by
resource id plus `updatedAt`. Combined evidence is bounded by
`AI_CONTEXT_MAX_LESSON_CONTENT_CHARS`.

Lesson mode is deliberately strict: description and extracted/text resource content are the only
factual sources; titles and filenames identify scope but do not prove facts; chat history may
clarify a follow-up but is not evidence. Adjacent topics are refused if the current lesson does
not contain them. Losing lesson access rejects the next turn instead of silently converting the
thread into general chat.

### Main tutor

Without a lesson, `buildLearningScopeContext` constructs an authenticated scope:

- Trainee: published courses assigned through active group memberships.
- Trainer: published courses created by that trainer or assigned to their active groups.
- Super Admin: all published, non-deleted courses.
- The user's department plus the platform's supported technical-learning domains.

General technical knowledge is allowed only inside that scope. Unrelated geography, politics,
news, entertainment, shopping, personal advice, and similar requests are refused. For example,
“What is the capital of India?” returns the deterministic out-of-scope learning response.

### Fail-closed response guard

Tutor providers must return an internal object such as:

```json
{ "decision": "ANSWER", "answer": "Markdown answer", "evidence": ["source-id"] }
```

`REFUSE` is the alternative. The backend accepts `ANSWER` only when it is non-empty and every
evidence id exists in the supplied lesson/course scope. Raw prose, malformed JSON, empty answers,
and invented evidence ids are replaced with a deterministic scope-specific refusal. The internal
envelope/evidence list is never shown to learners.

This is bounded prompt grounding plus response validation, not vector-search RAG. If supplied
evidence cannot support an answer, refusal is the intended result.

### Outbound personal-data redaction

Before external calls, the backend redacts high-confidence email addresses, formatted/compact
phone numbers, SSN-shaped identifiers, IP addresses, long payment-number-like sequences, and
labelled passwords/API keys/access tokens/refresh tokens/client secrets. The original LMS
message/content remains internal; only the provider copy is redacted. Names are not guessed,
because unreliable name detection would corrupt legitimate lesson text.

The same utility is applied to tutor system context/history/messages, completion-quiz lesson
material, and dashboard insight prompts.

## Lesson completion quiz

The lesson-quiz module uses a separate structured-output prompt to generate 4–5 multiple-choice
questions from the current lesson content only. Correct option ids remain server-side until
submission. `ProgressService` calls the same creation/check path before accepting `COMPLETED`, so
calling the progress endpoint directly cannot bypass the gate.

Quiz attempts are tied to `Lesson.contentVersion`. Learners must score at least 70%; a failed
submission can be followed by a newly generated attempt. Adding, editing, or deleting lesson
material increments the content version, reopens stale completion, and requires a quiz for the
new version.

A genuinely short text-only lesson may have no quiz requirement. An opaque file-only lesson asks
the trainer for readable text/transcript. Missing provider configuration, provider failure, or
invalid structured output after retry pauses completion with a safe 503. These fail-closed paths
avoid silently marking learning complete without evidence.

## Dashboard insights

Dashboard insights use a separate data-only prompt for 1–3 recommendations derived from real
analytics. Provider failure never breaks a dashboard: deterministic recommendations are returned
and labelled `HEURISTIC`, not `AI`.

## Provider and rate-limit behavior

Both provider adapters:

- allow the LMS to boot when their key is absent;
- map vendor rate limits to a safe 429 response;
- map configuration, permission, connection, and vendor failures to safe 503 responses;
- log actionable details server-side without exposing them to clients;
- report input/output tokens for successful tutor messages.

Tutor requests are limited per authenticated user (30 per 15 minutes by default), and lesson
quiz generation shares the AI limiter at its HTTP entry point. Production uses the shared
PostgreSQL rate-limit store; local development defaults to memory. Provider responses are
currently request/response, not streamed.
