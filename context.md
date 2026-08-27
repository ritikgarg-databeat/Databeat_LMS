# Databeat LMS — Current Project Context

**Snapshot date:** 27 August 2026

**Source of truth:** the current `ai-lms` codebase, schema, migrations, automated checks, and
maintained project documentation.

## Purpose

This file gives a concise, current view of the whole platform. Use it when explaining the product,
reviewing proposed changes, onboarding a developer, or checking whether another document still
matches implemented behavior.

The root `README.md` remains the primary setup and feature reference. `ARCHITECTURE.md` explains
technical design, while `docs/` contains deployment, operations, testing, AI, video, and business
documentation.

## Product summary

Databeat LMS is a single-organization, AI-enabled corporate Learning Management System with three
server-enforced roles:

- `SUPER_ADMIN` manages the organization, platform settings, shared data, and executive views.
- `TRAINER` manages owned groups, creates learning and assessments, reuses shared published
  content, grades assigned learners, and reviews team performance.
- `TRAINEE` consumes assigned learning, completes quizzes and assessments, uses lesson-grounded AI,
  participates in Q&A, and sees personal progress.

There is no public self-registration. Accounts are provisioned by authorized staff.

The platform is appropriate for demonstrations and controlled pilot use. Organization-wide
production readiness additionally requires the security, infrastructure, load, recovery,
monitoring, and governance work described in maintained deployment and operations documentation.

## Current business capabilities

### Organization administration

- Create, edit, activate, and deactivate Trainers and Trainees.
- Organize people into departments, experience levels, and active or archived groups.
- Assign one Trainer to a group and manage group membership, transfers, CSV import, and duplication.
- Configure platform identity, support information, maintenance mode, personal appearance, and
  notification preferences.
- Review a Super-Admin-only audit history of important platform actions.
- Run organization-wide Executive Analysis and export operational/compliance reports.

### Shared course catalogue

- Courses contain ordered modules, lessons, and versioned resources.
- Resources support uploaded documents, presentations, images, videos, Markdown, code, text, ZIP,
  downloads, and links according to resource type and validation rules.
- Every Trainer can browse and assign the published shared course catalogue to active groups they
  own.
- Only the course creator or a Super Admin can change shared master content.
- A Trainer can duplicate a shared course to create an independently editable copy.
- Draft courses remain private to their creator and Super Admins until published.
- Physical resource cleanup is attempted when a resource, lesson, or course is deleted.

### Mandatory learning

- Mandatory/optional is an assignment-level rule on each course-to-group assignment.
- The same shared course can be mandatory for one group and optional for another.
- If a learner receives the course through multiple active groups, mandatory wins.
- Mandatory learning flattens published modules and lessons into one ordered sequence.
- Learners can revisit earlier lessons but cannot open a later lesson before completing the first
  incomplete one.
- Backend access checks enforce the same sequence as the UI.
- Videos require sequential coverage and prevent ordinary forward seeking beyond verified progress.
- Text, code, images, documents, downloads, links, and archives require their configured active
  review/opening evidence and acknowledgement.
- Resource evidence is tied to content version, so new or changed material must be reviewed.
- Mandatory lessons require sufficient readable evidence for a grounded completion quiz.
- Incomplete mandatory learners receive deduplicated periodic reminders from the worker.

### Completion and certificates

- Lesson progress tracks status, time, last view, and current content version.
- Adding, editing, removing, or publishing lesson material increments content version and invalidates
  stale completion where required.
- Completion quizzes are generated from current readable lesson evidence and require at least 70%.
- Correct answers remain server-side until submission.
- Provider failure or insufficient opaque evidence fails closed instead of silently bypassing a
  required quiz.
- Course completion is derived from all current published lessons.
- A completed learner can download a print-ready SVG certificate. It is a visual completion
  artifact, not a signed or publicly verifiable credential.

### Question bank and assessments

- The question bank supports single-choice, multiple-choice, true/false, fill-in-the-blank, short
  answer, long answer, SQL, code, and file-upload questions.
- Assessments support availability windows, due dates, duration, passing percentage, optional
  negative marking, stable question randomization, and immediate or withheld results.
- Assessment questions are snapshotted so later bank edits do not change historical attempts.
- Objective answers are auto-graded; subjective, code, and file answers use manual grading.
- Timers and expiry are server-authoritative, and the worker finalizes abandoned expired attempts.
- A Trainer can reuse an accessible published assessment for owned groups, but only the creator or
  Super Admin can change the master definition.
- Trainer attempt lists and grading are limited to learners in the Trainer's assigned active groups.
- Main assessments currently allow one attempt per learner per assessment.

### Assessment integrity controls

- Protected attempts begin through a fullscreen start action.
- The assessment view hides normal application navigation and displays a learner watermark.
- Fullscreen exit, tab hiding, window blur, screenshot-key attempts, and print attempts are recorded.
- Simultaneous browser events are deduplicated.
- The first two counted violations warn; the third automatically submits the attempt.
- These controls are browser deterrence and evidence, not guaranteed screenshot/proctoring
  prevention.

### AI Tutor

- OpenAI and Anthropic adapters implement a shared provider interface selected through environment
  configuration.
- Lesson mode rebuilds live lesson context and restricts answers to current lesson evidence.
- Main Tutor mode is restricted to the learner's permitted LMS learning scope and refuses unrelated
  general trivia.
- Modes include chat, topic explanation, lesson summary, examples, and practice questions.
- Lesson answers validate evidence references rather than accepting invented source identifiers.
- Uploaded instructions are treated as untrusted lesson data, not system instructions.
- Common identifiers and credential-like values are redacted before external provider calls while
  the original message remains in LMS history.
- Answer language can be selected independently of the English application UI.
- Conversations and messages are persisted and remain subject to access checks.

### AI lesson videos

- Trainer video generation is feature-flagged and asynchronous.
- A Trainer selects supported lesson evidence, creative instructions, duration, language, voice,
  and visual style.
- OpenAI creates a schema-validated, source-referenced storyboard; model output is never executed as
  code.
- Trainers can edit and approve the storyboard before speech and deterministic Remotion rendering.
- Audio duration is measured before video rendering, and captions use actual speech alignment.
- Captions are omitted if reliable alignment cannot be produced.
- Drafts remain private and publishing atomically creates one normal lesson video resource.
- Publishing changes lesson content version and reopens affected learner completion.
- Trainees can request a short private lesson explanation video in AI Tutor. It is auto-approved,
  stored in chat history, limited by daily policy, and never becomes a lesson resource.
- Video work uses a PostgreSQL-leased worker queue with cancellation, retries, stale-content checks,
  draft cleanup, and low default render concurrency.

### Q&A, calendar, and notifications

- Q&A supports Markdown questions and answers, comments, tags, votes, attachments, verification,
  status, and search.
- Visibility may be organization-wide, department-scoped, or group-scoped.
- The same visibility policy is applied to questions, answers, comments, votes, tags, search, and
  attachment download.
- Linked course, module, and lesson identifiers are checked for user access and hierarchy
  consistency.
- Trainers can moderate within their active department/group scope; Super Admin has global backend
  scope.
- Calendar events can target departments, groups, or individuals without exposing unrelated target
  lists to ordinary viewers.
- Notifications cover assignments, deadlines, released results, Q&A activity, announcements, and
  mandatory reminders, with user mute preferences.

### Analytics, reports, and impact evidence

- Super Admin sees organization-wide Executive Analysis.
- Trainer sees group-scoped Team Performance for active owned groups.
- KPIs include reach, active learners, learning hours, completion, assessment score/pass rate,
  mandatory compliance, leaderboard, at-risk learners, and integrity events.
- Filters cover 7, 30, and 90-day ranges plus available department/group/course/assessment scope.
- The overview response has a 60-second cache/refresh cycle; longer-lived analytics snapshots use
  stale-while-refresh behavior.
- CSV exports cover learner progress, assessment results, groups, courses, and mandatory compliance.
- Timing Observations and Impact Metrics distinguish measured evidence from estimates and report
  insufficient sample sizes honestly.

## Access and ownership rules

### Super Admin

- Organization-wide access to supported administration and reporting operations.
- Exclusive access to platform settings, maintenance mode, and Audit Log UI.
- Can recover organization content whose original owner is unavailable.

### Trainer

- Can list only Trainees in active groups they own.
- Can manage only active groups assigned to them.
- Can browse published shared courses and assessments but cannot edit another creator's master.
- Can assign accessible published content only to owned active groups.
- Can view learner analytics, reports, attempts, grades, timing data, and private group discussions
  only inside owned active-group scope.
- Can create group/department-scoped Q&A only inside valid scope.

### Trainee

- Can access only published courses and assessments assigned through active group membership.
- Can access only their own progress, attempts, results, AI conversations, and private videos.
- Can view group/department Q&A and calendar data only through valid membership/assignment.
- Cannot bypass mandatory sequence or resource evidence by directly calling completion endpoints.

## Technology and runtime architecture

### Frontend

- React 19 and TypeScript.
- Vite production build with route-level lazy loading.
- Tailwind CSS v4 and Radix-based UI primitives.
- React Router role guards.
- TanStack Query for server state.
- React Hook Form and Zod for forms.
- Recharts for visual analytics.
- Zustand for small client-only UI state.
- Installable PWA shell; authenticated API data is not cached for offline use.

### Backend

- Node.js and Express 5 with TypeScript.
- Prisma ORM 7 and PostgreSQL/Neon.
- Layering: route → controller → service → repository → Prisma.
- JWT access token plus rotating hashed refresh-token sessions.
- Helmet, CORS, compression, validation, structured logging, request IDs, and rate limits.
- Separate API and worker processes from the same backend build.
- Provider abstractions for AI and storage.
- Local persistent storage implementation today; multi-instance deployments require shared storage
  or a new object-storage provider.

### Repository size and schema snapshot

- 27 backend domain-module directories.
- 19 frontend feature directories.
- 46 Prisma models.
- 21 checked-in database migrations.
- One focused backend hardening test file currently containing 18 tests.
- GitHub Actions CI installs locked dependencies, generates Prisma, applies migrations to PostgreSQL,
  typechecks, lints, tests, and builds both applications.

Backend modules:

`ai`, `analytics`, `assessment-attempts`, `assessments`, `audit-log`, `auth`, `calendar`, `courses`,
`dashboard`, `departments`, `experience-levels`, `group-members`, `groups`, `impact-metrics`,
`lesson-quiz`, `lessons`, `modules`, `notifications`, `progress`, `qna`, `questions`, `reports`,
`resources`, `settings`, `timing-observations`, `users`, and `video-generation`.

## Operational behavior

- The API exposes liveness and dependency-aware readiness endpoints.
- Readiness verifies PostgreSQL and upload-storage access; optional AI/video health does not block
  the ordinary LMS.
- Production should run API replicas with `RUN_SCHEDULER=false` and a separately supervised worker.
- Assessment expiry and reminders run on non-overlapping schedules with startup catch-up.
- Video jobs use database leasing and stage-level retry/idempotency behavior.
- Production rate limits should use the shared PostgreSQL store.
- Database backups do not include upload bytes; database and file backups must be coordinated.
- Deletion cleanup failures are logged for safe reconciliation instead of falsifying a successful
  database deletion.

## Current verification baseline

The latest local verification completed successfully for:

- Frontend and backend TypeScript checks.
- Frontend and backend lint.
- Backend hardening tests: 18 passed.
- Frontend and backend production builds.
- Production-hardening database invariants: zero invalid calendar, Q&A visibility, or Q&A comment
  rows.
- API readiness and frontend HTTP response.

This baseline is not a substitute for full browser E2E, penetration, accessibility, capacity,
backup-restore, or disaster-recovery testing.

## Important product boundaries

- The system is single-organization, not multi-tenant SaaS.
- Browser screenshot and assessment protection is best-effort.
- Published files use local storage unless a shared provider is implemented/configured.
- The current certificate is not a signed credential.
- The application UI is primarily English.
- Main assessments currently allow one attempt.
- AI depends on external provider availability, policy, privacy approval, and quota.
- AI grounding reduces hallucination risk but cannot guarantee perfect educational correctness.
- Scanned/image-only documents need readable text or a future OCR/transcription path for strong AI
  grounding.
- Reports and some analytics aggregation require production-scale load validation.
- Broad browser E2E and independent security testing remain required before enterprise rollout.

## Local development

```bash
npm run install:all
npm run prisma:generate
npm run dev
npm run dev:worker --prefix backend
```

Use environment files created from the checked-in examples. Never commit real database passwords,
JWT secrets, AI keys, email credentials, or production account credentials.

Useful checks:

```bash
npm run typecheck
npm run lint
npm test --prefix backend
npm run build
npm run check:invariants --prefix backend
```

Production migrations use `prisma migrate deploy`, not `prisma migrate dev`.

## Documentation map

- `README.md` — feature inventory, roles, setup, commands, configuration, and troubleshooting.
- `ARCHITECTURE.md` — system design, security model, data model, and scaling boundaries.
- `docs/README.md` — supplementary documentation index.
- `docs/BUSINESS_FEATURES.md` — business-facing feature and value summary.
- `docs/AI_WORKFLOW.md` — AI context, prompts, guardrails, extraction, redaction, and failure behavior.
- `docs/VIDEO_GENERATION.md` — Trainer/Trainee video generation and worker behavior.
- `docs/DEPLOYMENT.md` — deployment procedure and post-deployment verification.
- `docs/OPERATIONS.md` — API/worker operation, health, storage, backups, and retention.
- `docs/TESTING_CHECKLIST.md` — manual role and feature acceptance checklist.
- `docs/GIT_WORKFLOW.md` — branch, commit, review, and release conventions.
- `backend/docs/ERROR_HANDLING.md` — API error-handling contract.
- `backend/src/modules/*/README.md` — backend module-specific contracts and design decisions.
- `frontend/src/features/*/README.md` — frontend feature-specific structure and behavior.

Update this file whenever a material feature, role boundary, architecture decision, model count, or
production limitation changes.
