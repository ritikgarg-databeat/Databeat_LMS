# Databeat LMS Frontend

React 19 + TypeScript + Vite SPA for the Super Admin, Trainer, and Trainee experiences.

## Architecture

- `src/features/` contains domain UI, TanStack Query hooks, API services, and feature types.
- `src/routes/` owns lazy route loading and authenticated/role guards.
- `src/services/api/` owns Axios, in-memory access tokens, refresh-cookie recovery, and safe retries.
- `src/components/ui/` and `src/components/shared/` provide the reusable design system.
- Server data stays in TanStack Query; Zustand/local state is limited to client-only UI state.

The application includes course authoring and learning, version-aware completion, assessment
building/taking/grading/result release, grounded AI chat, password reset, analytics, notifications,
Q&A, calendar, reports, settings, and audit-log screens. Business-facing additions include
Executive/Team Performance views, compliance export, multilingual tutor answers, learner
completion summaries, downloadable SVG certificates, and production PWA installation.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

Set `VITE_API_URL` to the backend base URL including `/api/v1`. Production static hosting must
serve `index.html` as the fallback for client-side routes. See
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

Production builds register `public/sw.js`. It caches same-origin static assets and the SPA shell,
but deliberately excludes `/api/*`; authentication and live business data remain network-backed.
