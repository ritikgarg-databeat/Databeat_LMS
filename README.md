# Databeat LMS

AI-powered enterprise Learning Management System for corporate training — course delivery,
assessments, an AI-assisted lesson tutor, Q&A, calendar, analytics, notifications, audit
logging, and role-based administration for Super Admins, Trainers, and Trainees.

Full system design rationale lives in [`ARCHITECTURE.md`](ARCHITECTURE.md). This README covers
what's actually here today: features, roles, setup, day-to-day development, and deployment.

---

## Table of Contents

- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Super Admin Setup](#super-admin-setup)
- [Development Workflow](#development-workflow)
- [Scripts](#scripts-root)
- [Coding Standards](#coding-standards)
- [Deployment](#deployment)
- [Testing](#testing)
- [Documentation Map](#documentation-map)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Landing page & premium login** — public marketing page (no self-registration; accounts are
  admin-provisioned), split-layout login with "Remember me," dark/light/system theme.
- **Authentication & RBAC** — JWT access/refresh tokens (httpOnly refresh cookie), three roles
  (`SUPER_ADMIN` / `TRAINER` / `TRAINEE`), forced password change on first login for the seeded
  Super Admin account, single-use hashed password-reset links, immediate session revalidation
  after deactivation/role/password changes, and server-enforced authorization on every route.
- **User, Department & Group management** — create/edit/deactivate users, organize them into
  departments and training groups, assign trainers, bulk-import members via CSV.
- **Shared course pool** — Course → Module → Lesson hierarchy, file/markdown/link lesson
  resources, per-trainee progress tracking, course-to-group assignment, optional deep course
  duplication, and content versioning. Every trainer can browse and assign the published
  organization catalogue to groups they own; only the course creator or a Super Admin can change
  the shared master content. Drafts remain private to their owner and Super Admins until published.
  Adding, editing, or removing lesson material reopens stale learner
  completion and marks the lesson as updated until the learner revisits and completes it again.
  Learners also see a concise course-completion summary and can download a print-ready certificate
  after all current published lessons are complete.
- **Mandatory training per group** — Admins and Trainers decide whether each course assignment is
  mandatory or optional for each group. The same shared course can be required for Freshers and
  optional for another team. Mandatory delivery unlocks lessons in sequence, requires active
  review of every resource, verifies sequential video coverage, and requires a passing grounded quiz.
- **AI lesson-completion gate** — readable lesson theory generates a versioned comprehension
  quiz. A trainee must score at least 70% and may retry until they pass. Opaque uploaded material
  requires readable text/transcript, and provider failure pauses completion with a clear message
  rather than silently bypassing the learning check. Genuinely short text-only lessons can still
  complete without a quiz.
- **Assessments** — a reusable question bank (multiple question types), timed assessments with
  auto- or manual grading, negative marking, group assignment, attempt tracking and results.
  Published assessments can be reused by trainers for groups they own, while master-definition
  changes remain restricted to the creator or a Super Admin. Attempt lists and grading stay scoped
  to each trainer's assigned groups.
  Manually-graded question types (short/long answer, code snippet, file upload) queue for
  trainer review; fully auto-gradable attempts are scored the moment they're submitted. Timers
  are server-authoritative, expired abandoned attempts are finalized by the worker, assessment
  definitions lock once attempts exist, and withheld results can be released with learner
  notifications.
  Protected attempts start in fullscreen, display a learner watermark, record browser integrity
  events, warn twice, and submit automatically on the third counted violation.
- **Calendar** — events assignable to a department, a group, or an individual user, each seeing
  it through their own calendar automatically.
- **AI Tutor** — lesson-contextual AI chat with a swappable provider (OpenAI or Anthropic),
  conversation history, strict lesson/course-domain guardrails, evidence-id validation,
  deterministic refusal of irrelevant questions, selectable answer language (English, Hindi,
  Spanish, French, German, Portuguese, or Japanese), and redaction of common personal identifiers
  and credentials before any text is sent to an external provider.
- **AI lesson videos** — Trainers select grounded lesson sources, edit and approve a storyboard,
  render a narrated Remotion video, review it privately, and publish it atomically as a lesson
  resource. Trainees can request a short private lesson explainer from the Tutor, subject to daily
  limits; it is auto-rendered into chat history and never changes shared lesson content.
- **Q&A** — trainees ask questions (optionally scoped to a course/lesson/group), trainers and
  peers answer, trainers can mark an answer verified. Organization, department, and group
  visibility is enforced consistently for questions, answers, comments, votes, tags, search, and
  attachments; linked course/module/lesson references are validated against the user's access.
- **Executive, Manager & Compliance analytics** — organization-wide Executive Analysis for
  Admins and group-scoped Team Performance for Trainers, with 7/30/90-day filters, workforce
  reach and adoption, transparent ROI estimates, completion and assessment charts, mandatory
  compliance, employees needing attention, integrity events, 60-second refresh/cache behavior,
  drill-downs, and five CSV exports including an audit-ready mandatory-compliance report.
- **Audit Log** — a Super-Admin-only, filterable, immutable history of platform events (logins,
  user/group/course changes, assessment submissions, and more) for accountability and
  troubleshooting.
- **Measurable-impact instrumentation** — a trainer-facing tool for logging real manual-vs-
  AI-assisted timing comparisons, usage-derived latency reports (auto-grading, AI quiz
  generation, CSV import), and a pilot-cohort dashboard, all built around one rule: a figure is
  only ever labeled "measured" or "validated" once it clears fixed sample-size thresholds
  (`backend/src/constants/impact-report.ts`) — otherwise the platform says "insufficient data,"
  never a placeholder number.
- **Notifications** — in-app notifications for assignments, deadlines, released assessment
  results, Q&A activity, trainer announcements, and weekly-deduplicated incomplete mandatory
  training reminders, with per-type mute preferences. A dedicated worker runs catch-up checks on
  startup and non-overlapping schedules thereafter; notification reads never run reminder work.
- **Operational safety** — request IDs, structured logs, liveness/readiness endpoints, graceful
  shutdown, a separate scheduler worker, shared PostgreSQL-backed production rate limits,
  upload magic-byte checks and root-boundary enforcement, plus physical file cleanup when a
  resource, lesson, or course is deleted. Client responses expose authenticated download URLs,
  never internal resource or assessment-upload storage paths.
- **Settings** — personal (avatar, theme, notification preferences) and platform-wide
  (Super Admin only) configuration, including a maintenance-mode switch that blocks all
  non-Super-Admin access platform-wide.
- **Responsive, accessible UI** — desktop/tablet/mobile layouts, keyboard navigation, visible
  focus states, `prefers-reduced-motion` respected throughout. The production SPA is installable
  as a PWA; its service worker caches only the application shell/static assets and never caches
  authenticated API traffic.

## Roles & Permissions

Three roles, enforced server-side on every route (not just hidden in the UI):

| Capability                                           | Super Admin |     Trainer     |    Trainee    |
| ---------------------------------------------------- | :---------: | :-------------: | :-----------: |
| Manage users, departments, groups                    |     ✅      |        —        |       —       |
| Manage own assigned groups (roster, announcements)   |     ✅      |       ✅        |       —       |
| Platform settings & maintenance mode                 |     ✅      |        —        |       —       |
| View the audit log                                   |     ✅      |        —        |       —       |
| Create/edit courses, modules, lessons, question bank |     ✅      |       ✅        |       —       |
| Create & assign assessments, grade attempts          |     ✅      |       ✅        |       —       |
| Take courses, complete lessons, attempt assessments  |      —      |        —        |      ✅       |
| Ask/answer Q&A                                       |     ✅      |       ✅        |      ✅       |
| Use the AI Tutor API / current portal                |  API only   |    API only     |      ✅       |
| View own analytics/progress                          |     ✅      | ✅ (own groups) | ✅ (own data) |
| Export progress, results, and compliance evidence    |     ✅      | ✅ (own groups) |       —       |
| Download a completed-course certificate              |      —      |        —        |      ✅       |
| Log timing observations / view pilot dashboard       |     ✅      | ✅ (own groups) |       —       |

A Super Admin account is provisioned once at seed time; every other account (Trainer or
Trainee) is created by a Super Admin or Trainer — there is no public sign-up.

---

## Tech Stack

**Frontend:** React 19, Vite (Rolldown), TypeScript (strict), Tailwind CSS v4 (CSS-first
`@theme` config), shadcn-style hand-authored component library on Radix UI primitives, React
Router v7 (route-level code splitting via `React.lazy`), TanStack Query v5, React Hook Form +
Zod, Axios, Zustand (client/UI state), Framer Motion, Recharts, Lucide Icons.

**Backend:** Node.js, Express 5, TypeScript (strict), Prisma ORM 7 against PostgreSQL via
`@prisma/adapter-pg` (bounded, pre-warmed API and worker pools; Neon traffic uses its pooled
runtime endpoint — deliberately not the `@prisma/adapter-neon` WebSocket driver, which targets
short-lived edge/serverless invocations rather than this app's long-running Node process), JWT
(`jsonwebtoken`), bcrypt,
Multer, Helmet, Morgan, Compression, CORS, express-rate-limit, express-validator, Winston,
node-cron (scheduled jobs), a swappable AI provider layer (Anthropic and OpenAI SDKs).

**Database:** Neon serverless PostgreSQL (any standard Postgres works; Neon is what this
project develops and deploys against).

---

## Project Structure

```
ai-lms/
├── frontend/          React + Vite SPA
├── backend/           Express API server
├── docs/              Deployment guide, testing checklist, git workflow, AI workflow
├── package.json        Root orchestration scripts (run both projects together)
└── README.md           You are here
```

### Frontend (`frontend/src/`)

| Folder                     | Purpose                                                                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/`           | Design-system primitives (Button, Input, Dialog, Select, Tabs, ...)                                                                                                                                                                                             |
| `components/shared/`       | Composite components (EmptyState, ConfirmDialog, LoadingScreen, ErrorScreen, ...)                                                                                                                                                                               |
| `components/layout/`       | Sidebar, Header, Breadcrumbs, MobileNav, Footer                                                                                                                                                                                                                 |
| `config/`                  | Build-time env var access                                                                                                                                                                                                                                       |
| `constants/`               | Roles, routes, file types, HTTP status, messages                                                                                                                                                                                                                |
| `contexts/` / `providers/` | Auth/theme/query context + provider implementations                                                                                                                                                                                                             |
| `features/`                | 19 feature modules — `ai`, `analytics`, `assessment`, `audit-log`, `auth`, `calendar`, `classroom`, `dashboard`, `departments`, `groups`, `impact-metrics`, `landing`, `notifications`, `profile`, `qna`, `reports`, `settings`, `timing-observations`, `users` |
| `hooks/`                   | Cross-feature hooks (`useAuth`, `useTheme`, `useDebounce`, ...)                                                                                                                                                                                                 |
| `layouts/`                 | Admin/Trainer/Trainee/Auth/Public page shells                                                                                                                                                                                                                   |
| `routes/`                  | React Router route tree (`React.lazy`-split page components), route guards                                                                                                                                                                                      |
| `services/api/`            | Shared Axios client + auth-refresh interceptor                                                                                                                                                                                                                  |
| `store/`                   | Zustand client-UI-state store (sidebar collapse, mobile nav, etc.)                                                                                                                                                                                              |
| `styles/`                  | Global stylesheet + design tokens (`globals.css`)                                                                                                                                                                                                               |
| `utils/`                   | Date, duration, file, storage, theme, and error helpers                                                                                                                                                                                                         |

### Backend (`backend/src/`)

| Folder          | Purpose                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/`       | Env loading/validation, app config, CORS config, Prisma client setup                                                                                                                                                                                                                                                                                                                                |
| `constants/`    | Roles, routes, feature limits, file types, status, HTTP codes, and messages                                                                                                                                                                                                                                                                                                                         |
| `controllers/`  | `BaseController` — shared response-envelope helpers                                                                                                                                                                                                                                                                                                                                                 |
| `jobs/`         | Non-overlapping worker schedules for assessment deadlines, mandatory-training reminders, expired-attempt finalization, and optional security-data retention                                                                                                                                                                                                                                         |
| `middleware/`   | Auth, RBAC, rate limiters (global/login/AI), request logger, error/404 handlers, force-password-change gate                                                                                                                                                                                                                                                                                         |
| `modules/`      | 27 domain modules — `ai`, `analytics`, `assessment-attempts`, `assessments`, `audit-log`, `auth`, `calendar`, `courses`, `dashboard`, `departments`, `experience-levels`, `group-members`, `groups`, `impact-metrics`, `lesson-quiz`, `lessons`, `modules`, `notifications`, `progress`, `qna`, `questions`, `reports`, `resources`, `settings`, `timing-observations`, `users`, `video-generation` |
| `repositories/` | `BaseRepository` and shared domain data-access code; infrastructure, bootstrap, seed, and invariant utilities also use Prisma where appropriate                                                                                                                                                                                                                                                     |
| `storage/`      | Storage abstraction (`StorageProvider` interface + `LocalStorageProvider`)                                                                                                                                                                                                                                                                                                                          |
| `docs/`         | [`ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md) — the error-handling standard every module follows                                                                                                                                                                                                                                                                                            |
| `prisma/`       | `schema.prisma`, migrations, `seed.ts` (core), `seed-demo.ts` (optional sample data)                                                                                                                                                                                                                                                                                                                |
| `logs/`         | Winston log output (gitignored)                                                                                                                                                                                                                                                                                                                                                                     |

Each module folder also carries its own `README.md` describing that module's specific design
decisions — start there for implementation detail beyond what this file covers.

---

## Installation

Prerequisites: Node.js 20+, npm, a PostgreSQL database (Neon recommended — this project
develops and deploys against it).

```bash
# From the ai-lms/ root
npm run install:all

# Configure environment variables
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# then edit backend/.env with your real DATABASE_URL and JWT secrets (see below)

# Generate the Prisma client
npm run prisma:generate

# Apply migrations (production-safe, non-interactive)
cd backend && npx prisma migrate deploy && cd ..
# For local iterative schema development instead: cd backend && npx prisma migrate dev

# Seed the first Super Admin account (required)
npm run seed

# Run both frontend and backend
npm run dev

# In a second terminal, run the required background worker
npm run dev:worker --prefix backend
```

---

## Environment Variables

**Frontend** (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5000/api/v1
```

**Backend** (`backend/.env`):

```env
PORT=5000
NODE_ENV=development
TRUST_PROXY=false
RUN_SCHEDULER=false                       # keep false in API processes
RATE_LIMIT_STORE=memory                   # use postgres in production/multi-instance deployments
DATABASE_URL=postgresql://...              # Neon (or any Postgres) connection string
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d
REFRESH_EXPIRES_REMEMBER_ME=30d
UPLOAD_PATH=./src/uploads
CORS_ORIGIN=http://localhost:5173           # required (fails loudly at boot) in production
PASSWORD_RESET_URL=http://localhost:5173/reset-password
PASSWORD_RESET_EXPIRES_MINUTES=30
EMAIL_WEBHOOK_URL=                           # reset-link delivery endpoint; optional for local-only use
ADMIN_EMAIL=admin@lmsplatform.com           # seed-only — first Super Admin account
ADMIN_PASSWORD=ChangeMe@123                 # seed-only — forced to change on first login

# AI Tutor — swappable provider, both optional (app boots fine with neither set; /ai/chat
# and AI quiz generation return a clear 503 instead). AI_PROVIDER picks which one is active —
# only that vendor's key actually gets used.
AI_PROVIDER=openai                          # "openai" (default) or "anthropic"
MAIN_OPENAI_API_KEY=                        # used when AI_PROVIDER=openai
MAIN_OPENAI_MODEL=gpt-5.3-codex
ANTHROPIC_API_KEY=                          # used when AI_PROVIDER=anthropic
AI_MODEL_ID=claude-opus-4-8

# Trainer AI lesson video studio (disabled by default)
VIDEO_GENERATION_ENABLED=false
VIDEO_STORYBOARD_MODEL=gpt-4o-mini
VIDEO_TTS_MODEL=gpt-4o-mini-tts
VIDEO_TRANSCRIPTION_MODEL=whisper-1
VIDEO_RENDER_CONCURRENCY=1
VIDEO_FRAME_CONCURRENCY=50%
VIDEO_MAX_DURATION_SECONDS=480
VIDEO_DRAFT_RETENTION_DAYS=7
VIDEO_RENDER_TIMEOUT_MS=900000
```

See `.env.example` in each project for the full, documented list, and
**`.env.production.example`** in each project for the production-specific version (stricter
defaults, e.g. `CORS_ORIGIN` has no dev fallback) — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
for the full production walkthrough, and [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) for how
the AI provider layer actually works end to end.

---

## Database Setup

```bash
cd backend
npx prisma migrate deploy   # apply all migrations (production-safe, non-interactive)
npx prisma generate         # regenerate the Prisma client
```

For local schema iteration during development, use `npx prisma migrate dev` instead, which
also prompts for a migration name and can reconcile drift interactively — never use `migrate
dev` against a shared/production database.

---

## Super Admin Setup

The first Super Admin account is created by the core seed script, reading credentials from
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (env vars, with the defaults shown above if unset):

```bash
npm run seed --prefix backend
```

Idempotent — safe to re-run (a second run makes no changes since the account already exists).
**The very first login with this account is required, server-side, to go through a forced
password change before any other action succeeds** — this isn't just a UI nicety, the backend
rejects every other authenticated API call until the password has been changed at least once.
See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) § 3 for the full first-login flow.

Once the password is changed, the Super Admin has full access to create Trainers, Departments,
Groups, and configure platform-wide settings from the admin UI.

### Optional demo data

```bash
npm run seed:demo --prefix backend
```

Populates two sample departments/groups, a demo trainer, three demo trainees, a course, an
assessment, and a calendar event — useful for demos or a fresh contributor's local database.
Never run this against a real production database with real users. See
`backend/src/prisma/seed-demo.ts`'s header comment for the exact demo credentials it creates.

---

## Development Workflow

```bash
# Run both frontend and backend together
npm run dev

# Or individually
npm run dev:frontend    # http://localhost:5173
npm run dev:backend     # http://localhost:5000

# Required for expiry finalization and proactive reminders
npm run dev:worker --prefix backend
```

Before committing:

```bash
npm run typecheck
npm run lint
npm run format:check
```

See [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) for branch naming, commit message
convention, and versioning strategy.

---

## Scripts (root)

| Script                            | Description                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`                     | Run frontend + backend dev servers concurrently                                          |
| `npm run build`                   | Build both projects for production                                                       |
| `npm run start`                   | Start the built backend (serves the API)                                                 |
| `npm run typecheck`               | Typecheck both projects                                                                  |
| `npm run lint` / `lint:fix`       | Lint both projects                                                                       |
| `npm run format` / `format:check` | Prettier format both projects                                                            |
| `npm run prisma:generate`         | Regenerate the Prisma client                                                             |
| `npm run prisma:migrate`          | Run Prisma migrations                                                                    |
| `npm run seed`                    | Seed the first Super Admin account (core, required)                                      |
| `npm run seed:demo`               | Seed optional sample departments/groups/course/assessment (backend-only, non-production) |
| `npm run install:all`             | Install dependencies for both projects                                                   |

Each project also has its own scripts beyond these — see `frontend/package.json` and
`backend/package.json`.

---

## Coding Standards

- **Folders:** `kebab-case`. **React components:** `PascalCase.tsx`. **Hooks:** `useCamelCase.ts`.
- **Backend files:** `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`,
  `<name>.routes.ts`, `<name>.validation.ts`, `<name>.dto.ts`, `<name>.types.ts` — one module
  folder per domain concept.
- **Layering (backend):** request-domain CRUD follows `routes → controller → service → repository
→ Prisma`. Bootstrap, scheduled retention, seed/invariant tooling, the PostgreSQL rate-limit
  store, and bounded AI context extraction are explicit infrastructure exceptions.
- **State (frontend):** server data → TanStack Query; client/UI-only state → Zustand
  (`store/`) or local `useState`. Never duplicate server data into a store.
- **API responses (backend):** always the standard envelope —
  `{ success, message, data }` on success, `{ success, message, errors }` on failure. See
  [`backend/docs/ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md) for the full standard
  (error class hierarchy, HTTP status mapping, what gets logged vs. what the client sees).
- **Comments:** only where the _why_ isn't obvious from the code (a workaround, an
  invariant, a non-obvious constraint) — not restating what well-named code already shows.
- **Prisma-first data access** — domain repositories use Prisma. Tagged, parameterized raw SQL is
  limited to the readiness `SELECT 1`, shared rate-limit bucket atomics, and the explicit database
  invariant checker.

Full architectural rationale for every decision above lives in `ARCHITECTURE.md`.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the complete production deployment guide:
Neon database setup and migrations, API + worker hosting (process manager, reverse proxy, TLS),
frontend static hosting (with SPA fallback routing), the Super Admin first-login flow, and a
post-deploy checklist.

---

## Testing

See [`docs/TESTING_CHECKLIST.md`](docs/TESTING_CHECKLIST.md) for the full manual QA checklist
across every feature area, and [`backend/docs/ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md)
for the error-handling standard every module follows. `npm test --prefix backend` runs the current
Node test suite covering core hardening invariants (group lifecycle, timer boundaries, trainer
scope, AI guardrails/redaction, quiz pass rules, upload signatures, and storage copies). CI runs
tests, typechecks, lint, and production builds; wider API-integration and browser E2E coverage
remain worthwhile follow-up work.

---

## Documentation Map

| Location                                                           | What it covers                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `README.md` (this file)                                            | Features, setup, and day-to-day development                                                                                     |
| `ARCHITECTURE.md`                                                  | Full system design rationale                                                                                                    |
| [`docs/BUSINESS_FEATURES.md`](docs/BUSINESS_FEATURES.md)           | Business-facing feature catalogue, value, role outcomes, and product boundaries                                                 |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                         | Production deployment, environment, and post-deploy checklist                                                                   |
| [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)                     | Branching, commits, and versioning strategy                                                                                     |
| [`docs/TESTING_CHECKLIST.md`](docs/TESTING_CHECKLIST.md)           | Manual QA checklist by feature area                                                                                             |
| [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md)                       | How every AI feature actually works — real system prompts, context builder, provider abstraction, error handling, rate limiting |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md)                         | API/worker process model, health checks, storage, backups, retention, and production runbook                                    |
| [`backend/docs/ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md) | Backend error-handling standard (error classes, HTTP mapping, logging)                                                          |
| `backend/src/modules/*/README.md`                                  | Per-module design notes (26 of 27 modules; `experience-levels` is intentionally small)                                          |

---

Trainer publishing and private trainee tutor video generation are documented in
[`docs/VIDEO_GENERATION.md`](docs/VIDEO_GENERATION.md). Trainees use the lesson-scoped **Video**
mode; Super Admins set the platform daily allowance and trainers may apply a stricter group limit.

## Troubleshooting

| Symptom                                                                      | Likely cause                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend won't start, "Missing required environment variable"                 | Check `DATABASE_URL`/`JWT_SECRET`/`JWT_REFRESH_SECRET` are set; in production, `CORS_ORIGIN` is required too                                                                                                                         |
| Frontend can't reach the API (network errors)                                | `VITE_API_URL` doesn't match where the backend is actually running, or the backend isn't up                                                                                                                                          |
| CORS error in the browser console                                            | Backend's `CORS_ORIGIN` doesn't exactly match the frontend's origin (scheme + host + port)                                                                                                                                           |
| Login succeeds but every other request 403s with "must change your password" | Expected for a never-changed-password account (e.g. a freshly seeded Super Admin) — complete the change-password flow, not a bug                                                                                                     |
| `429 Too Many Requests` during heavy local testing                           | The global/login/AI rate limiters are working as designed — wait for the window to reset, or check `RateLimit-Reset`                                                                                                                 |
| AI Tutor / lesson quiz returns 503                                           | The active provider's key (`MAIN_OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, per `AI_PROVIDER`) is unset, or the provider itself returned an error (e.g. a real rate-limit/quota error from the vendor) — this is by design, not a crash |
| Assessment timers/reminders do not progress in the background                | Start exactly one worker with `npm run dev:worker --prefix backend` (development) or `npm run start:worker --prefix backend` (built deployment)                                                                                      |
| Prisma errors after pulling new migrations                                   | Run `npx prisma generate` again — the generated client is out of sync with the schema                                                                                                                                                |

If video generation stays queued, enable the feature, start the worker, verify the API and worker
share persistent `UPLOAD_PATH`, and install the Chromium/FFmpeg prerequisites.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)'s own troubleshooting table for
production-specific issues (SPA routing 404s, file upload persistence, etc.).
