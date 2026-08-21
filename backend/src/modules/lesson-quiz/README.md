# Lesson Quiz Module

Owns versioned AI-generated comprehension attempts that gate trainee lesson completion.

Layering: `lesson-quiz.routes.ts` → controller → service → repository. The router is mounted under
`/api/v1/lessons/:id/quiz`; the progress service also calls the same service-level gate directly.

## Content and generation

Quiz evidence is assembled from the lesson description, Markdown/code resources, and extracted
PDF/DOCX/PPTX text. Provider-bound lesson text is passed through personal-data/credential
redaction. Generated output must contain 4–5 questions with four options and one valid answer;
malformed output is retried once and then treated as unavailable.

The behavior is fail-closed where learning evidence is expected:

- genuinely short text-only content can return `{ required: false }`;
- an opaque uploaded document without readable text/transcript returns a content conflict;
- missing provider configuration/provider failure/invalid output returns a safe 503 and pauses
  completion rather than silently bypassing the gate.

## Versioning, pass rule, and retries

Every attempt stores `contentVersion` and `attemptNumber`. A current-version `GENERATED` attempt
is reused until submission. Submission reveals correct options, stores percentage, and passes at
70% or above. A failed submitted attempt does not satisfy completion; the next fetch/gate check
generates a new numbered attempt for the same content version. Historical attempts remain stored.

Adding, deleting, or editing lesson content increments `Lesson.contentVersion` and reopens
completed learner progress. Old attempts cannot satisfy the new version, so the learner must pass
a freshly grounded quiz and mark the lesson complete again.

## Bypass-resistant completion

`ProgressService.upsertLessonProgress` calls `checkCompletionGate` immediately before accepting a
transition to `COMPLETED`. That method invokes the same get-or-create logic as the quiz UI. A
client that skips the dialog and calls the progress endpoint directly therefore triggers the quiz
requirement and receives 403 until a current-version passing attempt exists.

## Routes

| Method | Path                       | Access                                      |
| ------ | -------------------------- | ------------------------------------------- |
| `GET`  | `/lessons/:id/quiz`        | Authenticated; lesson access/scope enforced |
| `POST` | `/lessons/:id/quiz/submit` | Authenticated; lesson access/scope enforced |

Correct option ids are never included in the generated pre-submission payload. Trainer/Super
Admin preview access follows trainer course scope; trainees require a published lesson/module/
course assigned through an active group membership.
