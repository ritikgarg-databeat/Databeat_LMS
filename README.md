# Databeat LMS

AI-powered enterprise Learning Management System for corporate training — course delivery,
assessments, an AI-assisted lesson tutor, Q&A, calendar, analytics, notifications, and
role-based administration for Super Admins, Trainers, and Trainees. **v1.0, production-ready.**

Full system design rationale lives in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (one level up
from this project root). This README covers what's actually here today: features, setup,
day-to-day development, and deployment.

---

## Features

- **Landing page & premium login** — public marketing page (no self-registration; accounts are
  admin-provisioned), split-layout login with "Remember me," dark/light/system theme.
- **Authentication & RBAC** — JWT access/refresh tokens (httpOnly refresh cookie), three roles
  (`SUPER_ADMIN` / `TRAINER` / `TRAINEE`), forced password change on first login for the seeded
  Super Admin account, server-enforced authorization on every route.
- **User, Department & Group management** — create/edit/deactivate users, organize them into
  departments and training groups, assign trainers, bulk-import members.
- **Classroom** — Course → Module → Lesson hierarchy, file/markdown/link lesson resources,
  per-trainee progress tracking, course-to-group assignment.
- **Assessments** — a reusable question bank (multiple question types), timed assessments with
  auto- or manual grading, negative marking, group assignment, attempt tracking and results.
- **Calendar** — events assignable to a department, a group, or an individual user, each seeing
  it through their own calendar automatically.
- **AI Tutor** — lesson-contextual AI chat (Claude), conversation history, gracefully degrades
  (503) instead of failing to boot when no API key is configured.
- **Q&A** — trainees ask questions (optionally scoped to a course/lesson/group), trainers and
  peers answer, trainers can mark an answer verified.
- **Analytics & Reports** — trainer/admin dashboards (completion, scores, engagement,
  leaderboards), CSV exports.
- **Notifications** — in-app notifications for assignments, deadlines, Q&A activity, and
  trainer announcements, with per-type mute preferences.
- **Settings** — personal (avatar, theme, notification preferences) and platform-wide
  (Super Admin only) configuration.
- **Responsive, accessible UI** — desktop/tablet/mobile layouts, keyboard navigation, visible
  focus states, `prefers-reduced-motion` respected throughout.

---

## Tech Stack

**Frontend:** React 19, Vite (Rolldown), TypeScript (strict), Tailwind CSS v4 (CSS-first
`@theme` config), shadcn-style hand-authored component library on Radix UI primitives, React
Router v7 (route-level code splitting via `React.lazy`), TanStack Query v5, React Hook Form +
Zod, Axios, Zustand (client/UI state), Framer Motion, Recharts, Lucide Icons.

**Backend:** Node.js, Express 5, TypeScript (strict), Prisma ORM 7 against PostgreSQL via
`@prisma/adapter-pg` (a standard long-lived connection pool — deliberately not the
`@prisma/adapter-neon` WebSocket driver, which targets short-lived edge/serverless
invocations rather than this app's long-running Node process), JWT (`jsonwebtoken`), bcrypt,
Multer, Helmet, Morgan, Compression, CORS, express-rate-limit, express-validator, Winston,
Anthropic SDK (AI Tutor).

**Database:** Neon serverless PostgreSQL (any standard Postgres works; Neon is what this
project develops and deploys against).

---

## Project Structure

```
ai-lms/
├── frontend/          React + Vite SPA
├── backend/           Express API server
├── docs/              Deployment guide, testing checklist, git workflow
├── package.json        Root orchestration scripts (run both projects together)
└── README.md           You are here
```

### Frontend (`frontend/src/`)

| Folder | Purpose |
|---|---|
| `components/ui/` | Design-system primitives (Button, Input, Dialog, Select, Tabs, ...) |
| `components/shared/` | Composite components (EmptyState, ConfirmDialog, LoadingScreen, ErrorScreen, ...) |
| `components/layout/` | Sidebar, Header, Breadcrumbs, MobileNav, Footer |
| `config/` | Build-time env var access |
| `constants/` | Roles, permissions, routes, file types, HTTP status, messages |
| `contexts/` / `providers/` | Auth/theme/query context + provider implementations |
| `features/` | Feature modules — `ai`, `analytics`, `assessment`, `auth`, `calendar`, `classroom`, `dashboard`, `departments`, `groups`, `landing`, `notifications`, `profile`, `qna`, `reports`, `settings`, `users` |
| `hooks/` | Cross-feature hooks (`useAuth`, `useTheme`, `useDebounce`, ...) |
| `layouts/` | Admin/Trainer/Trainee/Auth/Public page shells |
| `routes/` | React Router route tree (`React.lazy`-split page components), route guards |
| `services/api/` | Shared Axios client + auth-refresh interceptor |
| `store/` | Zustand client-UI-state store (sidebar collapse, mobile nav, etc.) |
| `styles/` | Global stylesheet + design tokens (`globals.css`) |
| `utils/` | Date/file/validation/permission/theme/error/notification helpers |

### Backend (`backend/src/`)

| Folder | Purpose |
|---|---|
| `config/` | Env loading/validation, app config, CORS config, Prisma client setup |
| `constants/` | Roles, permissions, routes, file types, status, HTTP codes, messages |
| `controllers/` | `BaseController` — shared response-envelope helpers |
| `middleware/` | Auth, RBAC, rate limiters (global/login/AI), request logger, error/404 handlers, force-password-change gate |
| `modules/` | 22 domain modules, each with `controller/service/repository/validation/routes/types/dto` — `ai`, `analytics`, `assessment-attempts`, `assessments`, `auth`, `calendar`, `courses`, `dashboard`, `departments`, `experience-levels`, `group-members`, `groups`, `lessons`, `modules`, `notifications`, `progress`, `qna`, `questions`, `reports`, `resources`, `settings`, `users` |
| `repositories/` | `BaseRepository` — shared Prisma client access (only repositories touch Prisma directly) |
| `storage/` | Storage abstraction (`StorageProvider` interface + `LocalStorageProvider`) |
| `docs/` | [`ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md) — the error-handling standard every module follows |
| `prisma/` | `schema.prisma`, migrations, `seed.ts` (core), `seed-demo.ts` (optional sample data) |
| `logs/` | Winston log output (gitignored) |

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
DATABASE_URL=postgresql://...              # Neon (or any Postgres) connection string
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES=15m
REFRESH_EXPIRES=7d
REFRESH_EXPIRES_REMEMBER_ME=30d
UPLOAD_PATH=./src/uploads
CORS_ORIGIN=http://localhost:5173           # required (fails loudly at boot) in production
ADMIN_EMAIL=admin@lmsplatform.com           # seed-only — first Super Admin account
ADMIN_PASSWORD=ChangeMe@123                 # seed-only — forced to change on first login
ANTHROPIC_API_KEY=                          # optional — AI Tutor degrades to 503 if unset
AI_MODEL_ID=claude-opus-4-8
```

See `.env.example` in each project for the full, documented list, and
**`.env.production.example`** in each project for the production-specific version (stricter
defaults, e.g. `CORS_ORIGIN` has no dev fallback) — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
for the full production walkthrough.

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

| Script | Description |
|---|---|
| `npm run dev` | Run frontend + backend dev servers concurrently |
| `npm run build` | Build both projects for production |
| `npm run start` | Start the built backend (serves the API) |
| `npm run typecheck` | Typecheck both projects |
| `npm run lint` / `lint:fix` | Lint both projects |
| `npm run format` / `format:check` | Prettier format both projects |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run seed` | Seed the first Super Admin account (core, required) |

Each project also has its own scripts (including `seed:demo`, backend-only) — see
`frontend/package.json` and `backend/package.json`.

---

## Coding Standards

- **Folders:** `kebab-case`. **React components:** `PascalCase.tsx`. **Hooks:** `useCamelCase.ts`.
- **Backend files:** `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`,
  `<name>.routes.ts`, `<name>.validation.ts`, `<name>.dto.ts`, `<name>.types.ts` — one module
  folder per domain concept.
- **Layering (backend):** `routes → controller → service → repository → Prisma`. Only the
  repository layer imports the Prisma client.
- **State (frontend):** server data → TanStack Query; client/UI-only state → Zustand
  (`store/`) or local `useState`. Never duplicate server data into a store.
- **API responses (backend):** always the standard envelope —
  `{ success, message, data }` on success, `{ success, message, errors }` on failure. See
  [`backend/docs/ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md) for the full standard
  (error class hierarchy, HTTP status mapping, what gets logged vs. what the client sees).
- **Comments:** only where the *why* isn't obvious from the code (a workaround, an
  invariant, a non-obvious constraint) — not restating what well-named code already shows.
- **No raw SQL** — Prisma is the query layer, confirmed zero `$queryRaw`/`$executeRaw` usage
  anywhere in the codebase.

Full architectural rationale for every decision above lives in `ARCHITECTURE.md`.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the complete production deployment guide:
Neon database setup and migrations, backend hosting (process manager, reverse proxy, TLS),
frontend static hosting (with SPA fallback routing), the Super Admin first-login flow, and a
post-deploy checklist.

---

## Testing

See [`docs/TESTING_CHECKLIST.md`](docs/TESTING_CHECKLIST.md) for the full manual QA checklist
across every feature area, and [`backend/docs/ERROR_HANDLING.md`](backend/docs/ERROR_HANDLING.md)
for the error-handling standard every module follows. Automated test coverage
(`backend/package.json`'s `test` script) is a placeholder today — a good next investment beyond
this v1.0 release.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend won't start, "Missing required environment variable" | Check `DATABASE_URL`/`JWT_SECRET`/`JWT_REFRESH_SECRET` are set; in production, `CORS_ORIGIN` is required too |
| Frontend can't reach the API (network errors) | `VITE_API_URL` doesn't match where the backend is actually running, or the backend isn't up |
| CORS error in the browser console | Backend's `CORS_ORIGIN` doesn't exactly match the frontend's origin (scheme + host + port) |
| Login succeeds but every other request 403s with "must change your password" | Expected for a never-changed-password account (e.g. a freshly seeded Super Admin) — complete the change-password flow, not a bug |
| `429 Too Many Requests` during heavy local testing | The global/login/AI rate limiters are working as designed — wait for the window to reset, or check `RateLimit-Reset` |
| Prisma errors after pulling new migrations | Run `npx prisma generate` again — the generated client is out of sync with the schema |

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)'s own troubleshooting table for
production-specific issues (SPA routing 404s, file upload persistence, etc.).
