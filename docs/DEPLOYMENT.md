# Deployment Guide

Production deployment steps for Databeat LMS — a two-part deployment (a static frontend SPA
and a stateful Node backend API) plus a managed Neon PostgreSQL database. See the root
[`README.md`](../README.md) for local development setup; this doc assumes you're deploying an
already-working local checkout to a real environment.

For day-two process, health, backup, upload, and retention procedures, also read
[`OPERATIONS.md`](OPERATIONS.md).

---

## Architecture recap (what you're deploying)

- **Frontend**: a Vite-built static React SPA (client-side routed with React Router) — deploy
  the build output to any static host or CDN.
- **Backend API + worker**: two long-running Express/Node build targets — both need a persistent
  host/process manager rather than request-scoped serverless functions:
  - Local file uploads (`UPLOAD_PATH`) are written to disk on whichever instance handled the
    request — this only works correctly with a single backend instance, or with `UPLOAD_PATH`
    pointed at shared/networked storage if you scale horizontally.
  - The API serves HTTP only (`RUN_SCHEDULER=false`). Exactly one worker runs assessment expiry,
    reminder, and optional retention schedules. Critical jobs catch up immediately after restart
    and prevent overlapping executions.
  - Production rate limiting uses the shared PostgreSQL store (`RATE_LIMIT_STORE=postgres`), so
    counters remain consistent across API replicas.
- **Database**: Neon serverless PostgreSQL (already the target throughout development).

---

## 1. Database (Neon)

1. Create a Neon project at [neon.tech](https://neon.tech) (or use an existing one).
2. Create a database (e.g. `databeat_lms_production`) — keep it separate from any
   development/staging database.
3. Copy the **pooled** connection string (the one with `-pooler` in the hostname — Neon shows
   both a pooled and a direct connection string; the pooled one is what `DATABASE_URL` should
   use in production, since Prisma's connection pooling assumptions match a pooler better than
   a direct connection under real concurrent traffic). Format:
   ```
   postgresql://<user>:<password>@<project>-pooler.<region>.aws.neon.tech/<database>?sslmode=require
   ```
4. **Backups**: Neon takes automatic point-in-time-recovery snapshots on paid plans (check your
   plan's retention window in the Neon console under Backup/Restore) — no extra setup needed
   beyond confirming your plan tier includes the retention window you need. For an extra layer
   of safety before major migrations, use Neon's branching feature to create a throwaway branch
   of production first, test the migration against the branch, then apply it to the real branch.
5. **Migrations**: from the `backend/` directory, with `DATABASE_URL` pointed at the production
   database:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
   `migrate deploy` (not `migrate dev`) is the production-safe command — it applies existing
   migration files without prompting or attempting to reconcile schema drift interactively.
6. **Seed the first Super Admin** (see § 3 below) — only ever run this once per environment;
   it's idempotent (safe to re-run, but there's no reason to on an already-seeded database).

---

## 2. Backend deployment

1. Copy `backend/.env.production.example` to `backend/.env` on the production host (or set the
   equivalent variables through your host/CI's environment-variable configuration — never
   commit the real `.env`). Fill in every `REQUIRED` value — see the file's own comments for
   what each one does. At minimum: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `CORS_ORIGIN` (must exactly match the frontend's deployed origin), `NODE_ENV=production`,
   `RUN_SCHEDULER=false`, and `RATE_LIMIT_STORE=postgres`. Configure `PASSWORD_RESET_URL` and
   `EMAIL_WEBHOOK_URL` before relying on self-service password reset. Tune
   `DATABASE_POOL_MAX`/`DATABASE_POOL_WARM_CONNECTIONS` for each API replica and normally keep
   the worker-specific pool/warm values at `1`; see the operations runbook.
2. Install dependencies and build:
   ```bash
   cd backend
   npm ci
   npm run prisma:generate
   npm run build          # compiles TypeScript to dist/
   ```
3. Run migrations against the production database (see § 1 step 5) if you haven't already.
4. Seed the Super Admin account (see § 3) if this is a fresh database.
5. Start the API and one worker from the same build:
   ```bash
   npm run start          # node dist/server.js
   npm run start:worker   # node dist/worker.js (separate process)
   ```
   Run both under a process manager that restarts on crash and survives terminal disconnects.
   Scale API processes only; keep one scheduler worker unless a distributed job coordinator is
   introduced later.
6. Put a reverse proxy (Nginx, Caddy, your cloud provider's load balancer) in front of the
   Node process to terminate TLS and forward to `PORT` (default `5000`) — the app itself
   doesn't terminate HTTPS. Confirm the proxy forwards the real client IP (`X-Forwarded-For`)
   if you want rate limiting/logging to reflect real client IPs rather than the proxy's.
7. Confirm `UPLOAD_PATH` points at a directory that exists, is writable by the process, and
   persists across deploys/restarts (not a container's ephemeral filesystem, unless you mount a
   persistent volume there).
8. Smoke-test `GET /health/live` (process only) and `GET /health/ready` (database + upload storage).
   `/health` remains a compatibility alias for readiness.

---

## 3. Super Admin setup (first run only)

The core seed script creates exactly one account: the first Super Admin. Run it once, against
the production database, after migrations are applied:

```bash
cd backend
ADMIN_EMAIL=admin@yourcompany.com ADMIN_PASSWORD='SomeStrongTemp#Pass1' npm run seed
```

(Or set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` before running `npm run seed` with no inline
override — either works, since `seed.ts` reads them via the same `env` config module as
everything else.) If you don't set these, it falls back to `admin@lmsplatform.com` /
`ChangeMe@123` — fine for a quick trial, but change them for anything real.

**What happens on first login**: regardless of which email/password you seed with, the account
is created with no password-change history, which the backend's login flow treats as
"must change password" — the very first successful login is **required** by the server (not
just suggested by the UI) to go through the password-change flow before any other API call
succeeds. This is enforced server-side (`require-password-change.middleware.ts`), so there's no
way to skip it even by calling the API directly. Once changed, the Super Admin has full,
permanent access and can proceed to create trainers, departments, and groups from the admin
UI.

The seed script is idempotent — re-running it against an already-seeded database does nothing
(the upsert matches on the existing email and makes no changes).

---

## 4. Optional demo data

A separate, entirely optional script populates realistic sample data (two departments, two
training groups, a sample trainer, three sample trainees, a course with a lesson, an
assessment, and a calendar event) — useful for demos, sales walkthroughs, or a new
contributor's local database. **Never run this against a real production database with real
users** — it's meant for a throwaway/demo environment only.

```bash
cd backend
npm run seed:demo
```

Also idempotent. See `backend/src/prisma/seed-demo.ts`'s header comment for the exact demo
account credentials it creates (overridable via `SEED_DEMO_TRAINER_EMAIL` /
`SEED_DEMO_TRAINER_PASSWORD` / `SEED_DEMO_TRAINEE_PASSWORD`). Demo accounts are seeded with
their password-change history already set, so they skip the forced first-login password change
— they're throwaway showcase logins, not real accounts that need password rotation.

---

## 5. Frontend deployment

1. Copy `frontend/.env.production.example` to `frontend/.env.production` (Vite automatically
   loads this file for `vite build` in production mode), or set `VITE_API_URL` as a build-time
   environment variable through your static host/CI instead. This MUST point at the real,
   publicly-reachable backend API URL, including the `/api/v1` prefix.
2. Build:
   ```bash
   cd frontend
   npm ci
   npm run build       # outputs to dist/
   ```
3. Deploy the contents of `dist/` to any static host: Vercel, Netlify, Cloudflare Pages, an S3
   bucket + CloudFront, or a plain Nginx server serving static files.
4. **SPA fallback routing is required**: this is a client-side-routed app (React Router) — the
   host must serve `index.html` for any path that doesn't match a real static asset (a 404 on
   `/admin/settings` after a hard refresh means this isn't configured). Vercel/Netlify handle
   this automatically for a Vite SPA; for a manual Nginx config, add a fallback:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```
5. Confirm the backend's `CORS_ORIGIN` env var includes this frontend's exact deployed origin
   (scheme + host + port) — a mismatch here manifests as every API call failing with a CORS
   error in the browser console, not a clear server-side error message.
6. Smoke-test: visit the deployed frontend URL, confirm the landing page loads, and confirm
   `/login` successfully authenticates against the deployed backend (network tab should show
   calls to `VITE_API_URL`, not `localhost`).
7. Serve `manifest.webmanifest`, `sw.js`, and `favicon.svg` from the site root. The production
   frontend registers the service worker automatically. Do not proxy or rewrite `/api/*` through
   the static asset cache; authenticated data is intentionally network-only.

---

## 6. Post-deploy checklist

If AI video is enabled, confirm the API and worker share `UPLOAD_PATH`, applicable Remotion
licensing is approved, Chromium/FFmpeg prerequisites are installed, and a test draft publishes.

- [ ] `GET /health/live` and `GET /health/ready` return 200.
- [ ] Exactly one worker is running and its startup log lists `expired-assessment-attempts`,
      `deadline-reminders`, and `mandatory-training-reminders`; catch-up completes without error.
- [ ] Frontend loads and `/login` successfully authenticates.
- [ ] Browser application tools show a valid web manifest and active service worker; the install
      action appears in a supported browser and API requests are absent from service-worker caches.
- [ ] Logged-in Super Admin is immediately prompted to change their password, and the app
      accepts no other action until it's done.
- [ ] After changing the password, the Super Admin can create a trainer, a department, and a
      group from the admin UI.
- [ ] `CORS_ORIGIN` matches the deployed frontend's exact origin (no CORS errors in the browser
      console on any authenticated action).
- [ ] `JWT_SECRET`/`JWT_REFRESH_SECRET` are unique, random, production-only values — never the
      `.env.example` placeholders.
- [ ] File uploads (e.g. an avatar or a lesson resource) succeed and are retrievable after a
      backend restart (confirms `UPLOAD_PATH` is a persistent, correctly-permissioned path).
- [ ] Deleting a test resource removes its physical upload; deleting a test lesson/course removes
      descendant files while files belonging to active or draft courses remain available.
- [ ] TLS/HTTPS is terminated in front of the backend (check for a valid certificate, not a
      bare HTTP connection).
- [ ] Rate limiting headers (`RateLimit-Limit`, etc.) are present on API responses.
- [ ] `RATE_LIMIT_STORE=postgres` is set and shared by every API replica.
- [ ] Forgot-password returns the same message for known/unknown emails and the configured email
      webhook delivers a usable, single-use reset link.
- [ ] See `backend/docs/ERROR_HANDLING.md` for what a real 500 should look like — confirm no
      stack traces or internal details are visible in any error response from the deployed API.

## Troubleshooting

| Symptom                                                                    | Likely cause                                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every API call fails with a CORS error in the browser console              | `CORS_ORIGIN` doesn't exactly match the frontend's deployed origin (check scheme, exact host, port)                                                                      |
| App works locally but 401s immediately in production                       | `JWT_SECRET`/`JWT_REFRESH_SECRET` weren't set (or differ between the value used to sign vs. verify — e.g. across multiple backend instances not sharing the same `.env`) |
| Backend won't start in production, "Missing required environment variable" | Check `CORS_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` are all set — these are all required when `NODE_ENV=production`                                  |
| Refreshing any non-root URL (e.g. `/admin/settings`) 404s                  | Static host isn't configured with SPA fallback routing — see § 5 step 4                                                                                                  |
| File uploads succeed but later 404 on download                             | `UPLOAD_PATH` isn't persistent across restarts/deploys (ephemeral container filesystem), or multiple backend instances don't share the same storage path                 |
| Timed attempts remain `IN_PROGRESS`, or reminders never arrive             | The worker is not running. Start `npm run start:worker --prefix backend`; keep `RUN_SCHEDULER=false` on API replicas                                                     |
| Password-reset request succeeds but no email arrives                       | `EMAIL_WEBHOOK_URL` is unset/unreachable or its bearer token is wrong; inspect structured backend logs using the request id                                              |
| Everyone behind the same office/VPN IP gets rate-limited together          | Confirm `TRUST_PROXY` matches the proxy topology and add a CDN/WAF policy if a shared NAT still needs a different fairness model                                         |
