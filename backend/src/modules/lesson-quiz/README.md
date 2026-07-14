# Lesson Quiz Module

Owns the `LessonQuizAttempt` model — an AI-generated, per-(lesson, trainee) completion quiz that
gates "Mark as complete" on the trainee lesson viewer.

Layering: `lesson-quiz.routes.ts` → `lesson-quiz.controller.ts` → `lesson-quiz.service.ts` →
`lesson-quiz.repository.ts` (see ARCHITECTURE.md §3.1). This module works directly against
`Lesson` / `CourseModule` / `Course` / `GroupMember` via Prisma for its accessibility check — it
deliberately does not import from the lessons/resources modules (feature-local duplication over
premature cross-module coupling, matching the progress/resources modules' precedent).

## Flow

1. A trainee's client calls `GET /lessons/:id/quiz` when they click "Mark as complete" (not on
   lesson load — this can trigger a real, billed LLM call).
2. If no `LessonQuizAttempt` row exists for `(lessonId, userId)` yet, the service gathers the
   lesson's own text content (description + MARKDOWN/CODE_SNIPPET resource `content`, same
   sources `ai/context-builder.ts` uses). Below `LESSON_QUIZ_MIN_CONTENT_CHARS` of real content,
   or if the AI provider is unavailable/returns unparseable output twice, the response is
   `{ required: false }` — the client calls `POST /lessons/:id/progress {status: COMPLETED}`
   directly, identical to the pre-quiz-gate behavior.
3. Otherwise a `GENERATED` attempt is created (questions + `correctOptionId` stored server-side,
   never serialized to the client) and returned sanitized: `{ required: true, status:
   'GENERATED', questions: [...] }` (no correct-answer field).
4. The trainee answers and calls `POST /lessons/:id/quiz/submit`, which grades against the stored
   `correctOptionId`s, persists `SUBMITTED` + score/percentage, and returns the graded result
   (correct answers now revealed per question — same "reveal after submit" rule the assessment
   module uses). No retakes: `GENERATED → SUBMITTED` is one-way.
5. The client then calls `POST /lessons/:id/progress {status: COMPLETED}` as before.

## The completion gate (bypass-proof)

`progress.service.ts`'s `upsertLessonProgress` calls `lessonQuizService.checkCompletionGate(...)`
right before allowing the transition into `COMPLETED`. This calls the exact same
`getOrCreateAttempt` helper `getOrGenerate` uses — so a trainee who never opens the quiz UI and
calls the progress endpoint directly still gets gated: the check itself generates the quiz (or
determines none is required) rather than only checking for one that might already exist. A
`GENERATED`-but-unsubmitted attempt blocks completion with a 403; no attempt (not required) or a
`SUBMITTED` one lets it through.

## AI generation

Uses `aiProvider` (imported from `@/modules/ai`, same as `dashboard-insights.service.ts` already
does) with a dedicated system prompt demanding a single JSON object
(`{"questions":[{"text","options":[4 strings],"correctIndex"}]}`), 4-5 questions. The response is
parsed defensively (stray code fences stripped) and validated by hand (no schema library in this
backend); a malformed response is retried once with a stricter reminder, then falls back to
"not required" — the same graceful-degradation contract `dashboard-insights.service.ts`'s
`generateOrFallback` already established, just with "skip the gate" instead of a heuristic
substitute (there's no honest heuristic replacement for real quiz questions).

## Mounting

Mounted **nested** inside the lessons module's router, exactly like `resourcesRoutes`:

```ts
// inside lessons.routes.ts
import { lessonQuizRoutes } from '@/modules/lesson-quiz';

router.use('/:id/quiz', lessonQuizRoutes);
```

| Method | Path                          | Access                                                           |
| ------ | ----------------------------- | ----------------------------------------------------------------- |
| GET    | `/lessons/:id/quiz`           | Trainer/Super-Admin always; others via lesson-accessibility check |
| POST   | `/lessons/:id/quiz/submit`    | Trainer/Super-Admin always; others via lesson-accessibility check |
