# Qna Module

Stack-Overflow-style discussion forum (Prompt 7 § PART 2): questions, answers, comments,
upvotes, tags, and a lightweight cross-entity search.

## Naming — mounted at `/qna`, not `/questions`

The assessment Question Bank (Prompt 6) already owns `/api/v1/questions` (`backend/src/modules/
questions/`). This module is mounted at `/api/v1/qna` instead — so the forum's own "questions"
resource lives at `/api/v1/qna/questions`, deliberately avoiding the collision. This mount point
was already chosen by earlier scaffolding, before any Prompt 7 code existed.

## Structure — six independent vertical slices, one composing router

Unlike most modules in this codebase (one `<name>.controller/service/repository.ts` per
folder), this module has six self-contained slices, each with its own full file set
(`qna-<slice>.controller/service/repository/dto/types/validation.ts`), built by four separate
agents in parallel:

| Slice | Files | Owns |
|---|---|---|
| `qna-questions` | `qna-questions.*` | `QnaQuestion` CRUD, list/search, status, attachments |
| `qna-answers` | `qna-answers.*` | `QnaAnswer` CRUD, pin, trainer verification |
| `qna-comments` | `qna-comments.*` | `QnaComment` create/delete (on a question or an answer) |
| `qna-votes` | `qna-votes.*` | `QnaVote` toggle (upvote/un-upvote) |
| `qna-tags` | `qna-tags.*` | Read-only `QnaTag` listing/autocomplete |
| `qna-search` | `qna-search.*` | Cross-entity search (questions/tags/courses/lessons) |

`qna.routes.ts` is the only file that wires actual Express routes — it composes all six
slices' controllers/validation into one router mounted at `/qna`. There is no top-level
`qna.controller.ts`/`qna.service.ts`/`qna.repository.ts` — those would have been ambiguous
once six slices exist side by side, so they were removed during this module's build (the
original scaffolding's placeholder classes were never referenced by anything).

## Feature-local duplication (deliberate, not a bug)

Each slice keeps its OWN copy of `isQuestionAccessibleToUser(questionId, userId, role)`
(Prompt 7 § GROUP VISIBILITY), rather than importing `qna-questions`'s copy — this codebase's
established convention (see `resources`/`assessment-attempts` modules' own duplicated
lesson-accessibility checks from Prompts 5–6) for cross-cutting checks needed by multiple
modules built independently. `qna-questions.repository.ts#isQuestionAccessibleToUser` is the
canonical, most-documented version. The other copies are functionally identical EXCEPT for one
deliberate divergence: the questions slice additionally grants the question's AUTHOR view
access (an author must never lose sight of their own post, e.g. after being removed from the
question's group — "My Questions" would otherwise silently hide it). The answers/comments/votes
slices keep the plain rule: losing group/department access removes interaction rights, not
visibility of your own content.

## Visibility rule (Prompt 7 § GROUP VISIBILITY)

- `ORGANIZATION` — accessible to every authenticated user.
- `GROUP` — accessible to members of the question's `groupId` (`GroupMember` row).
- `DEPARTMENT` — accessible to users whose `User.departmentId` matches the question's.
- TRAINER/SUPER_ADMIN always have full access, everywhere, regardless of visibility.
- On create/update, a TRAINEE may only choose a `GROUP`/`DEPARTMENT` they actually belong to
  (400 if not — never leaks which other groups/departments exist). Staff may target any.
- A soft-deleted or genuinely nonexistent question is a 404; an existing one a caller can't see
  is a 403 — deliberately distinguished (unlike some Prompt 5/6 modules' "403 for everything"
  precedent), per this module's own spec. All six slices follow this convention.
- The question's author always retains VIEW access to their own question (list/detail), even
  after losing GROUP/DEPARTMENT access — see the note on the accessibility-check copies above.

## Answer lifecycle

- Any user who can see a question may answer it, unless it's `CLOSED` (`SOLVED` still accepts
  new answers).
- A trainer/admin verifying an answer (`POST /qna/questions/:id/verify-answer`) also promotes
  the question to `SOLVED`, unless it's already `CLOSED` (`CLOSED` always wins).
- Trainers/admins may pin any answer and edit any answer's content ("Edit final explanation" per
  spec) — trainees may only edit/delete their own.

## Votes are a toggle, not create-only

"Like/upvote" is implemented as toggle-on/toggle-off in `qna-votes.repository.ts#toggle`: voting
again on the same question/answer removes the existing vote. Two hand-added PARTIAL unique
indexes (not expressible in `schema.prisma`'s own syntax — see the `QnaVote` model's doc
comment and the `20260708120000_qna_forum_ai_tutor` migration) enforce one vote per user per
question/answer at the DB level; a raced `P2002` is caught and treated as "already voted"
rather than surfaced as a 500.

## Notifications

Two `NotificationType` values were added in a follow-up migration
(`20260708220000_qna_notification_types`): `QNA_ANSWER_POSTED` (question author, on a new
answer — skipped if you answer your own question) and `QNA_ANSWER_VERIFIED` (answer author, on
verification). Both use the same best-effort `.catch()`-wrapped `notificationsService.notify()`
pattern as the calendar/assessments modules (Prompt 6) — a transient notification failure never
fails the primary request. No notifications are sent for questions, comments, or votes.

## Known gaps (accepted scope for this milestone)

- Search (`qna-search`) is simple `contains`/`mode: insensitive` matching — no ranking, no
  full-text index, no vector/embedding search (explicitly out of scope per Prompt 7: "Do not
  implement advanced vector databases... yet"). Question results ARE visibility-scoped
  (`qna-search.repository.ts#findQuestions` duplicates the same GROUP VISIBILITY rule) — search
  never surfaces a question a caller couldn't otherwise open.
- Question attachments are author-only to upload (not trainer/admin) — kept simple for this
  milestone.
