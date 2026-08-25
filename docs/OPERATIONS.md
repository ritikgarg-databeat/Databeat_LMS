# Operations Runbook

This runbook describes the current production process model and the checks required to keep
Databeat LMS healthy. It complements [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Process model

Run the API and scheduler as separate long-running processes from the same build:

```bash
npm run start --prefix backend
npm run start:worker --prefix backend
```

Keep `RUN_SCHEDULER=false` in API processes and run exactly one worker for a normal deployment.
The worker owns:

- expired assessment finalization every minute;
- assessment-deadline reminders daily at 06:00;
- optional expired security-data retention daily at 03:00 when
  `RUN_RETENTION_CLEANUP=true`.
- PostgreSQL-leased AI video storyboard, speech, and render jobs when
  `VIDEO_GENERATION_ENABLED=true`, plus draft-retention cleanup.

Expiry and reminder tasks also execute once on worker startup to recover from downtime. Scheduled
runs use `noOverlap`, so a slow execution is not stacked on top of the next execution. The jobs
are idempotent at their domain boundaries.

Use a service manager or container restart policy for both processes. Graceful `SIGTERM`/`SIGINT`
shutdown stops HTTP/scheduled work and disconnects Prisma.

## Database connection performance

The application converts a direct Neon hostname to its pooled runtime endpoint automatically;
Prisma migration commands continue using the configured direct URL. The API opens a bounded,
pre-warmed pool before accepting traffic, avoiding first-request connection storms. Configure
`DATABASE_POOL_MAX` and `DATABASE_POOL_WARM_CONNECTIONS` for API concurrency. The separate worker
uses `DATABASE_WORKER_POOL_MAX` and `DATABASE_WORKER_POOL_WARM_CONNECTIONS`; keep both worker
values at `1` unless its job concurrency is deliberately increased. Total configured connections
across all replicas must stay within the database plan's limit.

Startup also warms the maintenance-mode setting. Thereafter it is refreshed in the background,
so a routine portal request never waits on that cross-cutting settings query. Authenticated-user
security state is cached for at most five seconds to collapse each page's parallel widget burst;
deactivation, password-change, and role-change enforcement therefore has a five-second maximum
in-process propagation delay rather than waiting for access-token expiry.

## Health checks

- `GET /health/live` proves the API process is alive without calling dependencies.
- `GET /health/ready` checks PostgreSQL and read/write access to `UPLOAD_PATH`; it returns 503 if
  either dependency is unavailable.
- `GET /health` is an alias of readiness for older deployment configuration.

Point liveness probes at `/health/live` and readiness/load-balancer probes at `/health/ready`.
Managed PostgreSQL may take longer on its first request after idle suspension, so use a realistic
readiness timeout and retry policy.

## Upload storage

`LocalStorageProvider` keeps only a relative pointer in PostgreSQL and resolves it below the
configured storage root. Uploads first land in an OS temporary directory, undergo declared-type
and magic-byte checks, and are then copied into `UPLOAD_PATH`. Path resolution rejects pointers
outside that root.

For a single host, mount `UPLOAD_PATH` on persistent storage. Every API instance must see the
same storage if the API is scaled horizontally; otherwise replace the provider with shared object
storage before scaling.

Deleting an individual resource removes its physical file. Deleting a lesson or course collects
all descendant file pointers and removes those physical files after the database deletion. File
cleanup failures are logged with the owner/resource/path for a safe manual retry; they do not turn
an already-completed database deletion into a false failed response.

Do not delete files solely by age or filename. Reconcile a suspected orphan against active and
draft course/resource rows first. Draft courses are active platform data and their files must be
retained.

AI video previews use separate `video-generation-*` namespaces under the same storage root.
Publishing copies only the approved MP4 into `lesson-resources`. Cancellation, expiry, and
hierarchy deletion remove drafts and cached narration; renderer health never blocks API readiness.

## Backups

Database backups do not contain uploaded file bytes. Protect both data sets:

1. Confirm PostgreSQL point-in-time recovery or scheduled logical backups and test restoration.
2. Snapshot/replicate the persistent upload volume on a matching schedule.
3. Before a risky migration, take a database branch/snapshot and an upload-volume snapshot.
4. Keep backup retention aligned with the organization's privacy and training-record policy.

## Rate limiting and proxies

Use `RATE_LIMIT_STORE=postgres` in production so global, login, and AI abuse counters are shared
between API processes. `memory` is intended only for local single-process development.

Set `TRUST_PROXY` to match the exact proxy topology. A wrong value can make logs/rate limits use
the proxy IP or trust spoofed forwarding headers. `CORS_ORIGIN` must list exact frontend origins.

## Password reset delivery

Password reset tokens are random, hashed at rest, single-use, time-limited, and consume all old
sessions on successful reset. Configure:

- `PASSWORD_RESET_URL` to the deployed frontend reset route;
- `PASSWORD_RESET_EXPIRES_MINUTES` to the approved validity window;
- `EMAIL_WEBHOOK_URL` and optional `EMAIL_WEBHOOK_BEARER_TOKEN` for delivery.

The forgot-password response is intentionally identical for existing and nonexistent accounts.
Without a delivery webhook, reset requests remain safe but users will not receive the link.

## Retention cleanup

`RUN_RETENTION_CLEANUP` defaults to `false`. Enable it only after approving
`EXPIRED_SECURITY_DATA_RETENTION_DAYS`; it removes expired password-reset and refresh-token rows,
not courses, lessons, learner results, uploads, or audit logs.

## Release checks

```bash
npm run typecheck
npm run lint
npm test --prefix backend
npm run build
cd backend && npx prisma migrate deploy
```

After deployment, verify frontend loading, `/health/live`, `/health/ready`, login/refresh, one
upload/download, AI configuration if included in the demo, and worker startup logs listing
`expired-assessment-attempts` and `deadline-reminders`.
