# Databeat LMS — Full Project Context (Ground Truth Snapshot)

**Snapshot date:** this document was generated directly from the live codebase and live database
of the `ai-lms/` project — every feature, number, and status below was verified by reading the
actual source code, querying the actual database, or exercising the actual running application
(via curl and a real Chromium browser), not recalled from memory or copied from older materials.

## How to use this document

**Purpose:** this file exists so you can hand it to a separate Claude conversation (claude.ai or
otherwise) together with your existing pitch deck / PPT / other documentation, and ask: *"does
this deck/doc still match what the product actually is and does?"* Everything in this file is
ground truth as of the snapshot date above. Where the project's own pitch materials (in `pitch/`)
say something different from this file — especially around numbers, attribution, or pilot status
— **this file is the one that reflects the current, real state**; the pitch materials may need to
catch up to it.

This file deliberately repeats itself in places (e.g., the Measurable Impact numbers appear both
in the feature section and in the history section) — that's intentional, so each section is
self-contained enough to quote on its own without cross-referencing the whole document.

**A rule this whole project has followed, and that this document follows too:** never state a
number, a name, or a status as fact unless it's been verified against real code or a real running
system. Where something is unconfirmed, this document says so plainly instead of guessing.

---

## 1. What Databeat LMS Is

**One-liner:** an AI-powered, enterprise Learning Management System for corporate training —
built in-house as a real, working, three-role product, not a mockup or a pitch-only concept.

**The problem it solves:** training teams normally stitch together a shared drive for course
content, a separate quiz tool, a spreadsheet to track who's actually progressing, and a chat tool
for questions. Nobody can easily answer "who is actually learning," and every "quick check" on a
lesson has to be hand-written by a trainer, every single time.

**Three roles, one platform:** `SUPER_ADMIN`, `TRAINER`, `TRAINEE` — enforced server-side on every
route, not just hidden in the UI. There is no public self-registration; every account is
admin-or-trainer-provisioned.

**Current maturity:** fully working end-to-end across all three roles. The core path — login,
course delivery, lesson completion gated by an AI-generated quiz, assessment submission and
grading (auto and manual), trainer dashboards, Super Admin audit log — was re-verified live this
session, including a fresh rebuild of the production bundle and a real-browser walkthrough
against that rebuilt bundle. Automated test coverage is the one honestly-still-open gap (see
§10).

---

## 2. Complete Feature Inventory

### 2.1 Super Admin Portal — org command center

- Org-wide dashboard (not scoped to one group): total/active/archived groups, departments,
  trainees, course counts by status, assessment counts by status, recently-created groups.
- Create/edit/deactivate/reactivate Trainer and Trainee accounts; one-time temporary password
  resets; deactivating a user blocks their next login attempt (and kills existing sessions).
- Manage Departments and every Group across the company from one list (archive/restore groups).
- Full authoring parity with Trainers on courses, question bank, and assessments, org-wide (not
  limited to groups a Super Admin happens to be assigned to — Trainers, by contrast, only manage
  their own assigned groups).
- **Audit Log** (`/admin/audit-log`, Super-Admin-only): a filterable, paginated, immutable history
  of every security-relevant platform event — see §7 for full detail.
- **Platform Settings**: platform name, support email, and a **maintenance-mode switch** that
  blocks every non-Super-Admin request platform-wide (including requests from a token issued
  before the toggle was flipped, not just new logins) with a clear message; Super Admins remain
  fully unaffected while it's on.

### 2.2 Trainer Portal — where training gets built

- **Course authoring**: Course → Module → Lesson hierarchy. Lessons accept file, markdown, or
  link-type resources (PDF, PPTX, DOCX, video, images, external links, or hand-written Markdown).
  Publish/assign courses to specific groups.
- **Question Bank & Assessments**: 9 question types — `SINGLE_CORRECT_MCQ`, `MULTIPLE_CORRECT`,
  `TRUE_FALSE`, `FILL_IN_THE_BLANK`, `SHORT_ANSWER`, `LONG_ANSWER`, `SQL_QUERY`, `CODE_SNIPPET`,
  `FILE_UPLOAD` — across 10 categories (`PYTHON`, `SQL`, `STATISTICS`, `DATA_ANALYTICS`,
  `MACHINE_LEARNING`, `POWER_BI`, `EXCEL`, `SPARK`, `HADOOP`, `GENERAL`) and 3 difficulty levels
  (`EASY`, `MEDIUM`, `HARD`). Assessments support negative marking, question randomization,
  due dates/available-from windows, and a passing-percentage threshold. Editing a bank question
  never silently changes an assessment that already used it — each assessment stores a snapshot
  of the question at assignment time.
- **Grading**: the 5 auto-gradable types (`SINGLE_CORRECT_MCQ`, `MULTIPLE_CORRECT`, `TRUE_FALSE`,
  `FILL_IN_THE_BLANK`, `SQL_QUERY`) score the instant an attempt is submitted — no queue, no
  separate step. The 4 manual-review types (`SHORT_ANSWER`, `LONG_ANSWER`, `CODE_SNIPPET`,
  `FILE_UPLOAD`) route to a dedicated grading queue with the trainee's answer and any answer key
  shown side-by-side; an attempt with any manual-review question sits in `PENDING_REVIEW` until a
  trainer scores every such answer, then moves to `GRADED`.
- **Groups & bulk onboarding**: CSV bulk-import of trainees with a per-row added/skipped/error
  report. Groups carry a department, an experience level, and one assigned trainer. A Trainer can
  only manage groups they're actually assigned to — a different Trainer's group returns 403.
- **Dashboard**: pending-grading alert, a live trainee leaderboard (transparent scoring formula),
  and an AI Insights card flagging the worst-performing group — honestly labeled `AI` or
  `HEURISTIC` depending on whether the underlying model call actually succeeded (never silently
  presented as AI-generated if it fell back).
- **Reports**: one-click CSV exports (user progress, assessment results, group performance, course
  completion), scoped to only that Trainer's own groups.
- **Q&A moderation**, a shared **calendar** (events assignable to a department, a group, or an
  individual user — each sees it automatically through their own calendar), and org-wide
  **announcements** straight to trainee dashboards/notifications.
- **Timing Observations tool** (new since the original pitch — see §6.2) and a **Pilot Cohort
  Dashboard** (new since the original pitch — see §6.4).

### 2.3 Trainee Portal — the learning experience

- **My Classroom**: assigned courses with live progress bars, a "Continue Learning" strip, inline
  rendering of PDFs/slides/video — no download-and-reopen required.
- **★ The AI Completion Quiz** — the platform's headline feature. Clicking "Mark as complete" on a
  lesson triggers the AI to read that lesson's *actual* material (including text extracted from
  an uploaded PDF or slide deck) and writes a fresh 4–5 question quiz on the spot. Passing it
  completes the lesson. **This gate is enforced server-side**: calling the completion API directly
  still triggers the same check, so it cannot be bypassed from the client. If there's no real
  content to quiz on (e.g. a video-only lesson) or the AI provider is unavailable, the lesson
  completes normally instead — the gate only ever blocks when a quiz was actually generated and
  not yet submitted; it never blocks completion outright due to an AI failure.
- **Contextual AI Tutor**: opened from inside a lesson, already aware of what that trainee is
  looking at. 5 modes, all through one underlying chat pipeline with a mode-specific system
  prompt: `CHAT`, `EXPLAIN_TOPIC` (Beginner/Detailed/Interview depth variants),
  `SUMMARIZE_LESSON`, `GENERATE_EXAMPLES`, `GENERATE_PRACTICE_QUESTIONS`. Conversations persist and
  resume; lesson context is rebuilt fresh from the lesson's live content on every turn (so a
  trainee who's since lost access to that lesson keeps their conversation, but stops receiving its
  content in new turns).
- **Assessments**: resumable timed exams, per-answer autosave, instant grading on auto-gradable
  question types, one attempt per assessment (no retakes), the answer key withheld until grading
  is complete.
- **My Progress / My Performance**: a 13-week activity heatmap, weekly trend, streak counter, and
  one composite Performance Score (completion % + average score + recent activity).
- **Q&A** (ask, optionally scoped to a course/lesson/group; trainers and peers answer; trainers can
  mark an answer verified), **calendar** (merges real events with each assessment's own deadline),
  **notifications** with per-type mute preferences.

### 2.4 The AI Architecture — a genuine technical differentiator

Every AI feature (the Tutor, the Completion Quiz generator, the dashboard insights) runs through a
single swappable `AiProvider` interface, with **two working implementations already wired up**:
OpenAI and Anthropic. `AI_PROVIDER` (env var, default `openai`) picks which one is active — the
whole platform's AI vendor is a one-environment-variable switch, not a rewrite. Whichever provider
is active constructs its SDK client lazily as `null` when its key is unset, so the app still boots
normally; the affected endpoints (`/ai/chat`, AI quiz generation) return a clear `503` instead of
crashing or leaking a raw SDK error. A real provider-side error (e.g. a rate-limit/quota error from
the vendor) is caught and surfaced as a clear, user-facing message the same way. See
`docs/AI_WORKFLOW.md` for the full real system prompts, the lesson-context builder, and the exact
error-handling paths — this is documented in detail, not just summarized.

**Grounding is verifiable, not just claimed** — see `pitch/AI_GROUNDING_VERIFICATION.md` for a real,
already-generated quiz checked phrase-by-phrase against its real source lesson text (every
question and correct answer traced verbatim or near-verbatim to the actual lesson description,
with no invented facts). This was done specifically in response to Checkpoint 1 feedback asking
for exactly this kind of reviewable evidence (see §9).

### 2.5 Enterprise-readiness / security

- JWT dual-token auth: short-lived access token + rotated, hashed refresh token (httpOnly cookie),
  with theft detection — replaying a revoked/already-rotated refresh token kills every session for
  that user, not just the one request.
- Role-based access control, server-enforced on every route.
- **Audit logging** on every security-relevant action, structured so that recording an event never
  blocks the action it's recording (see §7).
- 3-tier rate limiting: a general app-wide limiter, a stricter login limiter, and a dedicated
  per-user AI limiter (because every AI call is a real, billed request).
- Swappable file-storage abstraction (`StorageProvider` interface, `LocalStorageProvider`
  implementation today — a cloud/S3 implementation can be dropped in later without touching call
  sites).
- Forced password change on first login for the seeded Super Admin account, enforced server-side
  (every other authenticated API call is rejected until it's done, not just a UI redirect).

### 2.6 Design & UX

Dark/light/system theme (persisted server-side per user, not just `localStorage`), one consistent
brand identity across every screen, fully responsive (desktop/tablet/mobile), keyboard navigation
with visible focus states, `prefers-reduced-motion` respected throughout.

---

## 3. Roles & Permissions Matrix

| Capability | Super Admin | Trainer | Trainee |
|---|:---:|:---:|:---:|
| Manage users, departments, groups | ✅ | — | — |
| Manage own assigned groups (roster, announcements) | ✅ | ✅ | — |
| Platform settings & maintenance mode | ✅ | — | — |
| View the audit log | ✅ | — | — |
| Create/edit courses, modules, lessons, question bank | ✅ | ✅ | — |
| Create & assign assessments, grade attempts | ✅ | ✅ | — |
| Take courses, complete lessons, attempt assessments | — | — | ✅ |
| Ask/answer Q&A | ✅ | ✅ | ✅ |
| Use the AI Tutor | ✅ | ✅ | ✅ |
| View own analytics/progress | ✅ | ✅ (own groups) | ✅ (own data) |
| Log timing observations / view pilot dashboard | ✅ | ✅ (own groups) | — |

---

## 4. Tech Stack & Architecture

**Frontend:** React 19, Vite (Rolldown), TypeScript (strict), Tailwind CSS v4 (CSS-first `@theme`
config), a shadcn-style hand-authored component library on Radix UI primitives, React Router v7
(route-level code splitting), TanStack Query v5, React Hook Form + Zod, Axios, Zustand
(client/UI-only state), Framer Motion, Recharts, Lucide Icons.

**Backend:** Node.js, Express 5, TypeScript (strict), Prisma ORM 7 against PostgreSQL via
`@prisma/adapter-pg` (a standard long-lived connection pool, deliberately not the
`@prisma/adapter-neon` WebSocket driver, which targets short-lived edge/serverless invocations
rather than this app's long-running Node process), JWT (`jsonwebtoken`), bcrypt, Multer, Helmet,
Morgan, Compression, CORS, express-rate-limit, express-validator, Winston, node-cron (scheduled
jobs), the Anthropic and OpenAI SDKs behind the swappable `AiProvider` seam.

**Database:** Neon serverless PostgreSQL (any standard Postgres works; Neon is what this project
actually develops and deploys against).

**Layering (backend):** `routes → controller → service → repository → Prisma`. Only the
repository layer imports the Prisma client. **API responses** always use one envelope:
`{ success, message, data }` on success, `{ success, message, errors }` on failure — documented in
full in `backend/docs/ERROR_HANDLING.md`. **No raw SQL anywhere** — confirmed zero
`$queryRaw`/`$executeRaw` usage across the whole codebase; Prisma is the only query layer.

**State (frontend):** server data always goes through TanStack Query; client/UI-only state goes
through Zustand or local `useState` — server data is never duplicated into a store.

---

## 5. Data Model — 26 Backend Domain Modules

Each module is a self-contained folder (`controller/service/repository/validation/routes/types/dto`,
plus its own `README.md` for 25 of the 26 — `experience-levels` is the one small lookup module
without one):

`ai`, `analytics`, `assessment-attempts`, `assessments`, `audit-log`, `auth`, `calendar`, `courses`,
`dashboard`, `departments`, `experience-levels`, `group-members`, `groups`, `impact-metrics`,
`lesson-quiz`, `lessons`, `modules`, `notifications`, `progress`, `qna`, `questions`, `reports`,
`resources`, `settings`, `timing-observations`, `users`.

**Of these, four modules did not exist in the project's original pitch-deck-era description of the
product** — they were added specifically in response to Checkpoint 1 feedback (see §9):
`audit-log`, `impact-metrics`, `lesson-quiz` (the AI completion-quiz gate's own module — the gate
concept existed before, but was consolidated here), and `timing-observations`.

**Notable lifecycle states:**
- `AssessmentAttempt.status`: `IN_PROGRESS` → `PENDING_REVIEW` (if any manual-review question
  exists) or straight to `GRADED` (if fully auto-gradable) → `GRADED`.
- `LessonQuizAttempt.status`: `GENERATED` (quiz created, not yet submitted — this is what blocks
  lesson completion) → `SUBMITTED` (unblocks it).
- `Group.status`: `ACTIVE` / `ARCHIVED` (soft-delete via `deletedAt` is separate from this).

**Audit action coverage** (`AuditAction` enum, 57 distinct values) spans: auth (login
success/failed, logout, password changes/resets), users (create/update/deactivate/reactivate/role
change), departments, groups (create/update/archive/restore/delete/member add-remove-transfer/bulk
import/trainer assignment), courses/modules/lessons/resources (full CRUD + reorder + group
assignment), questions and assessments (full CRUD + group assignment + question
add/remove/reorder + attempt submission + answer grading), calendar events, and Q&A
(questions/answers/comments — create/update/delete/status change/verify/pin), plus AI conversation
deletion. The exhaustive list lives in `backend/src/prisma/schema.prisma`.

---

## 6. The Measurable Impact System — Full Detail

**This entire system did not exist when the project's original pitch materials were written.** It
was built specifically because Checkpoint 1 scored "Measurable Early Impact" **7/20** — the
lowest-scoring category by far — for presenting projected/illustrative numbers as if a pilot had
already validated them, when no pilot had run yet. The fix wasn't a better one-off number; it's
real instrumentation that captures genuine, repeated, logged events going forward, plus a report
generator that is structurally incapable of calling anything "validated" until enough real
observations actually exist.

### 6.1 Timing Observations (`timing-observations` module)

A trainer-facing tool (and mirrored Super-Admin view) for logging a real, self-timed comparison of
writing a lesson quiz by hand vs. reviewing the AI-generated one for the same lesson. Every
submission requires a real course, a real lesson, a manual duration, and an AI-assisted duration
(both in seconds under the hood, entered as minutes in the UI). The live stats view directly below
the form always shows `n = X observations across Y trainers, Z lessons` alongside every computed
average — the UI has no code path that renders a mean without also rendering its `n`.

### 6.2 Impact Metrics — usage-derived reports (`impact-metrics` module)

Three reports computed live from real historical data already in the system, each returning `n`,
the date range, mean/median/min/max, and a low-sample-size flag when `n < 20`:
- **Auto-grading latency** — computed from real `AssessmentAttempt` rows where both
  `submittedAt` and `gradedAt` are set and every question on the attempt is auto-gradable.
- **AI quiz-generation latency** — computed from `LessonQuizAttempt.generationDurationMs`, a field
  added specifically for this (wraps the real `generateQuestions` call in the lesson-quiz service
  with `Date.now()` before/after).
- **CSV import speed** — computed from `AuditLog` rows where `action = GROUP_BULK_IMPORT` and
  `metadata.durationMs` is present (added the same way — wraps the real bulk-import method).

### 6.3 Pilot Cohort Dashboard

Parameterized by a group + date range (a `Group` is the cohort — no separate "pilot" concept was
needed). Computes, live, all scoped to that group's members and the date range: gate-compliance
rate (lesson completions that correctly required and passed a quiz vs. any exception, which is
flagged as a bug, not silently dropped), first-attempt quiz pass rate, grading turnaround for
manually-reviewed answers, and weekly-active percentage. Every number renders with its own `n` and
date range beside it.

### 6.4 Impact Report generator + the honesty gate

A single generated document/endpoint that assembles the above into one report — and every number
in it passes through one function, `classifyConfidence()`
(`backend/src/constants/impact-report.ts`), before it's allowed to be labeled anything other than
plain data:

```
MIN_N_FOR_VALIDATED = 10
MIN_DISTINCT_TRAINERS_FOR_VALIDATED = 3   // generalized to "distinct actors" per metric
MIN_PILOT_DAYS_FOR_VALIDATED = 3
LOW_SAMPLE_THRESHOLD = 20                 // below this, shown with a low-sample-size badge
```

`classifyConfidence(n, distinctActors, spanDays)` returns exactly one of: `'insufficient'` (n = 0
— rendered as literally "insufficient data — not yet measured," never a placeholder number),
`'measured'` (real data exists but hasn't cleared all three thresholds), or `'validated'` (all
three thresholds cleared). **This is the only place in the entire codebase the word "validated" is
allowed to be triggered from** — every other call site defers to this function rather than
checking counts itself. As of this snapshot, every one of the metrics above is at `'measured'` or
`'insufficient'` — **nothing in this system currently qualifies as `'validated'`**, and the system
is built so that it's structurally impossible to claim otherwise until a real multi-trainer,
multi-day pilot actually produces that volume of data.

### 6.5 Current real numbers (this snapshot — see `pitch/MEASURABLE_IMPACT_REAL_DATA.md` for the
full write-up with methodology)

| Metric | Real measured value | Sample size | Status |
|---|---|---|---|
| One-at-a-time trainee add | 3,627 ms | n=1 | measured, too small for a ratio |
| Bulk CSV import | 3,562 ms (1 row), 4,292 ms (2 rows) | n=2 | measured, too small for a ratio |
| Auto-grading turnaround (post-fix) | 2,802 ms | n=1 under corrected timing (n=2 blended incl. one stale pre-fix 0ms row) | measured |
| AI quiz generation (first-time, real model call) | 7,204 ms | n=1 | measured |
| Manual quiz-writing vs. AI-assisted review, live-timed | 24 min vs. ~30 sec (≈23.5 min saved/lesson; ≈15.7 hrs at the original 40-lesson scale) | n=1, one course, unattributed to a named trainer | measured |

**The old "4.3×" CSV speedup claim and the old "illustrative — validated in the pilot" framing
have both been explicitly retired** — they are not restated anywhere in the current pitch
materials as of this snapshot's remediation pass (see §9.4). Any pitch material that still cites
"4.3×" or calls any of the above "validated" is out of date and should be corrected to match this
section.

---

## 7. Audit Log — Full Detail

**Also new since the original pitch materials** (the original description only mentioned "audit
logging on every security-relevant action" as a backend capability; there was no admin-facing
viewer for it). Now a complete feature:

- `/admin/audit-log`, Super-Admin-only (403 for Trainer/Trainee, both the page and its API route).
- Filterable by action type, actor, target, date range, and free-text search; paginated; every row
  resolves and displays the actor's and target's real name inline (not just a raw user ID).
- Live-verified against real historical entries already accumulated in the database from actual
  platform use (logins, group changes, assessment submissions/grading, question/course edits,
  etc.) — not seeded placeholder rows.
- Recording an audit event never blocks the action it's recording (fire-and-forget from the
  action's own perspective).

---

## 8. AI Completion Quiz Gate + AI Tutor — Verification Detail

The completion gate (`lesson-quiz` module, `checkCompletionGate`, called from the `progress`
module's `upsertLessonProgress`) was live-verified this session in both directions: a trainee with
a `GENERATED`-status (unsubmitted) quiz attempt on a lesson was correctly blocked with a `403` when
trying to mark it complete; after submitting that quiz, the same completion request correctly
succeeded. A real external AI-provider failure (an actual OpenAI 429 "exceeded your current quota"
error — a real account-level billing limit, not a code bug) was also observed during testing and
confirmed to trigger the documented graceful-degradation path rather than blocking the trainee or
crashing anything.

AI grounding — see `pitch/AI_GROUNDING_VERIFICATION.md` for the phrase-by-phrase check of a real
generated quiz against its real source lesson text (§2.4 above summarizes the result).

---

## 9. History: Checkpoint 1 → Now (Complete Chronological Record)

This section exists specifically so you can see **what has changed since whatever version of the
pitch deck/PPT/docs you already have was written**, and judge how far out of date they might be.

### 9.1 Checkpoint 1 baseline (verbatim scores)

Overall: **82/100**. Judges' summary: *"A genuinely well-built, working three-portal LMS with AI
wired into the product rather than bolted on, let down mainly by impact numbers that are projected
rather than measured going into the checkpoint that's supposed to show early results."*

| Category | Weight | Score | What was asked for |
|---|---|---|---|
| Problem Definition & Idea Clarity | 15 | 14/15 | Name the real pilot team once chosen; ground the problem statement in a real trainer's own words instead of a composite persona. |
| Solution Approach & AI Methodology | 25 | 24/25 | Show sampled outputs from the completion quiz/tutor judged against source lesson material, so "grounded, not hallucinated" is verifiable. |
| Execution Progress / Prototype Maturity | 20 | 19/20 | Close three "Partial" maturity-table items: audit-log viewer UI, enforced maintenance-mode gate, scheduled reminders. |
| **Measurable Early Impact** | 20 | **7/20** | Replace the one projected number ("40 lessons × ~10 min = 6.5 hours," labeled "illustrative — validated in the pilot" before any pilot ran) with real measured numbers, even from a single real example. |
| Documentation Quality | 10 | 10/10 | One named gap: the "prompts/AI workflow documentation" artifact was two dead links, not standalone documentation. |
| Presentation & Communication | 10 | 8/10 | Narrate business-impact numbers explicitly on screen; never call a number "validated" before a pilot has actually validated it. |

### 9.2 Pass 1 — Measurable Impact instrumentation built (the 4-task build)

Built from scratch: the Timing Observations tool, the three usage-derived Impact Metrics reports,
the Pilot Cohort Dashboard, and the Impact Report generator with the `classifyConfidence` honesty
gate — everything described in full in §6. Live-verified with real events at build time, then
adversarially reviewed (multiple real bugs found and fixed before this was considered done).

### 9.3 Pass 2 — Comprehensive 11-section codebase audit

A full, file:line-cited, "UNVERIFIED"-flagged audit was run across: the Measurable Impact system's
source of truth, pilot tracking infrastructure, actual pilot/real-world usage evidence, feature
maturity, AI methodology, documentation state, stack/architecture, database, API surface,
security, and environment. Key findings that mattered for credibility:
- A person named "Sumit Sahu" was attributed to a real timing measurement in the docs/pitch
  materials, but no independently verifiable identity behind that name could be confirmed in the
  codebase or database.
- A "pilot team" name appeared in places, but the actual group in the database was a development/
  test fixture, not a confirmed real external cohort.
- The CSV-import and auto-grading timing numbers had structural problems: the single-add path
  logged no duration at all (only bulk-import did), and the auto-grading timer was started too
  late in the request (after the real DB reads had already happened), making its own "duration"
  partly tautological.
- The root README undercounted the backend module list ("22 domain modules" vs. the real 26).
- Several backend module `README.md` files still read "Foundation scaffolding only" despite being
  fully implemented.

### 9.4 Pass 3 — Remediation of the audit's findings

Executed directly (no invented replacements for any fabrication — where a real identity or number
didn't exist, the fix was to say so plainly, never to guess a substitute):
- **Sumit Sahu attribution removed.** No real, independently-confirmable person's name is
  attributed to the timing comparison. The measurement itself is kept (it's real), just presented
  as an unattributed real data point rather than a named quote.
- **Pilot team name made honest.** Docs now state plainly that no real external pilot team is
  confirmed yet, and that the existing database group is a development/test fixture — not renamed,
  not hidden, just labeled accurately.
- **The two structurally-broken numbers fixed and re-measured for real**: the single-add path now
  logs its own real duration (matching the bulk-import pattern); the auto-grading timer now starts
  at the very top of the request, before any DB reads. Both were re-run for real and the actual new
  numbers (see §6.5) were written into the docs, explicitly stating the small sample sizes (n=1,
  n=2) rather than implying more data than exists.
- **End-to-end product confirmed working**: a fresh install (`npm install` → migrate → seed →
  start) was run and the full core path was walked in a real browser — login, lesson completion
  gated by a real AI quiz (both the block and the pass), assessment submission, trainer dashboard,
  Super Admin audit log with real events.
- **Documentation corrected and completed**, including creating `docs/AI_WORKFLOW.md` — closing
  the exact "dead link" gap Checkpoint 1's Documentation Quality feedback named — and fixing the
  root README's module count (22 → 26, once the four Measurable-Impact-era modules were counted
  correctly).

### 9.5 Pass 4 — Full platform re-test, complete docs/README rewrite, test-data cleanup

- A comprehensive, real-browser Playwright walkthrough was run across all three portals (Super
  Admin, Trainer, Trainee), including previously-untested workflows (a full manual-grading cycle:
  new question → new assessment → publish → assign → student submit → trainer grade).
- All of `docs/` was rewritten for accuracy: `docs/README.md` now correctly indexes all 5 real
  files in that folder (it previously missed 3); `docs/TESTING_CHECKLIST.md` gained sections for
  Audit Log, Maintenance Mode, Scheduled Reminders, and Measurable Impact Instrumentation, and its
  AI Tutor section was corrected to be provider-agnostic (`AI_PROVIDER`/`MAIN_OPENAI_API_KEY`, not
  just `ANTHROPIC_API_KEY`).
- The root `README.md` was fully rewritten: a table of contents, a Roles & Permissions matrix (§3
  above), previously-undocumented real features added (Audit Log, the AI completion gate,
  Measurable Impact instrumentation, maintenance mode), a Documentation Map, and corrected
  AI-provider environment variable documentation (both the README and `backend/.env.example` were
  missing `AI_PROVIDER`/`MAIN_OPENAI_API_KEY`/`MAIN_OPENAI_MODEL` even though `AI_PROVIDER=openai`
  is the actual default active provider — fixed in both places).
- **Test data created purely for verification was cleaned up**: a throwaway trainee account and
  its cascade-linked records, a "Manual Grading Verification Test" assessment/question/attempt
  created solely to prove the grading workflow, a test Q&A question, and a duplicate Super Admin
  account created as a side effect of the fresh-install check — all removed after confirming (via
  direct database queries) they had no other real value. The real, substantive data — the one
  genuine `TimingObservation` row, and the real CSV-import audit-log timing entries — was
  deliberately kept, since `AuditLog.actorId`/`targetUserId` are `SET NULL` (not cascade) on user
  deletion, so that evidence survives independently of any test account cleanup.

### 9.6 Pass 5 — Cache/log clear, dead-code check, rebuild, rerun (this session's final pass)

- Stopped all dev-mode processes, cleared build caches (`dist/`, Vite's cache, stale
  `.tsbuildinfo`), swept the repo for stray/junk files (none found), and ran lint on both projects
  (0 errors on either — only pre-existing, structural warnings unrelated to dead code).
- **Rebuilding surfaced one genuine, previously-masked bug**: `timing-observations-page.tsx` used
  `z.coerce.number()` for its two duration fields, which this codebase's own established
  convention explicitly avoids (documented in `create-assessment-dialog.tsx`) because it creates a
  resolver input/output type mismatch under `react-hook-form`. Fixed to match the established
  string-field-plus-refine pattern used everywhere else in the codebase; rebuilt clean.
- **Verified the actual production build**, not just the dev servers: ran the real built backend
  (`node dist/server.js`) and the real built frontend (`vite preview`), then drove it with a real
  browser — logged in as Super Admin, confirmed the dashboard renders live real numbers (2
  trainees, 1 course, 1 assessment — correctly reflecting the Pass 4 cleanup), and confirmed the
  Audit Log shows genuine historical events.

---

## 10. Known Limitations / What NOT to Claim

Stated plainly, matching this whole project's own discipline — a pitch that admits these reads as
more credible than one that implies they're solved:

- **No automated test suite yet.** `backend/package.json`'s `test` script is a placeholder
  (`echo "No tests yet"`); there is no frontend test script either. This is an honestly-open gap,
  not something to claim as done.
- **No real pilot team is confirmed.** The group used throughout development (`Media_Freahers_2026`
  in the current dev database) is a development/test fixture, not a named real external cohort
  with a decided go-live date.
- **No named, attributed trainer quote exists** for the problem-statement section — the workflow
  pain described is real, but there is no first-person quote from a real, identifiable person to
  attribute it to yet.
- **Every Measurable Impact number today is `n=1` or `n=2`** — real, but small. Nothing currently
  qualifies as `'validated'` under `classifyConfidence`'s own thresholds (10 observations, 3
  distinct people, 3 distinct days) — and the system is deliberately built so it can't be made to
  say otherwise until that volume of real data actually exists.
- **The AI grounding verification (§2.4, §8) is one example, one lesson, one short
  description-based lesson** — it shows the grounding mechanism works once on real content; it is
  not a claim that it's been verified across every content type (PDF/PPTX/DOCX extraction uses
  different code paths not exercised in that specific verification) or every lesson.
- **The "15.7 hours saved" / "23.5 minutes per lesson" figures are one course, one live-timed run**
  — a genuine real measurement, not yet a multi-trainer, multi-lesson pilot average.

---

## 11. How to Run This Project

```bash
# From the ai-lms/ root
npm run install:all
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env   # then edit with a real DATABASE_URL and JWT secrets
npm run prisma:generate
cd backend && npx prisma migrate deploy && cd ..
npm run seed        # creates the first Super Admin account
npm run dev         # or: npm run build && npm start (backend) + npm run preview (frontend)
```

Full setup detail: root `README.md`. Production deployment: `docs/DEPLOYMENT.md`.

**Note on credentials:** the currently-live database's Super Admin/Trainer/Trainee test accounts
had their passwords reset to a shared known value during this session's verification work — see
the conversation history or ask directly for current working credentials if you need to log into
the existing dev database rather than a fresh install. A fresh install's Super Admin credentials
come from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `backend/.env` (defaults shown in `.env.example`).

---

## 12. Documentation Map

| Location | What it covers |
|---|---|
| `README.md` (project root) | Features, setup, day-to-day development — comprehensive |
| `ARCHITECTURE.md` | Full system design rationale (at this project's root) |
| `docs/DEPLOYMENT.md` | Production deployment, environment, post-deploy checklist |
| `docs/GIT_WORKFLOW.md` | Branching, commits, versioning strategy |
| `docs/TESTING_CHECKLIST.md` | Manual QA checklist by feature area |
| `docs/AI_WORKFLOW.md` | Real system prompts, context builder, provider abstraction, error handling, rate limiting |
| `backend/docs/ERROR_HANDLING.md` | Backend error-handling standard |
| `backend/src/modules/*/README.md` | Per-module design notes (25 of 26 modules) |
| `pitch/CODEBASE_AUDIT_REPORT.md` | The full 11-section audit referenced in §9.3 |
| `pitch/REMEDIATION_PLAN.md` | The planning document behind the §9.4 remediation pass |
| `pitch/MEASURABLE_IMPACT_REAL_DATA.md` | Full methodology behind every number in §6.5 |
| `pitch/PROBLEM_DEFINITION_UPDATE.md` | Full current pilot-team/trainer-quote honesty statement |
| `pitch/AI_GROUNDING_VERIFICATION.md` | The phrase-by-phrase AI grounding check referenced in §2.4/§8 |
| `pitch/CLAUDE_PROMPT_FOR_CHANGELOG_DOC.md` | A Checkpoint 1→2 changelog-writing prompt (written after Pass 3, before Pass 4/5 — slightly behind this document) |
| `pitch/CLAUDE_PROMPT_FOR_PITCH_PPT.md` | The original ground-truth prompt used to brief the pitch deck — written **before** the Measurable Impact system, Audit Log viewer, and most of §9 existed; use *this* file (`context.md`), not that one, as the current source of truth |
| `pitch/checkpoint-changelog.html` / `pitch/pitch-deck.html` / `pitch/PITCH_VIDEO_SCRIPT.md` | The actual existing pitch materials this document is meant to be checked against |
| `context.md` (this file) | The current, complete, up-to-date ground truth — regenerate this if the product changes again before your next resubmission |
