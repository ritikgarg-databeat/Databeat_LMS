# Documentation

Supplementary documentation that does not belong in the root [`README.md`](../README.md) or the
full system design document:

- [`BUSINESS_FEATURES.md`](BUSINESS_FEATURES.md) — business-facing feature catalogue, role
  outcomes, executive metrics, compliance workflow, and honest product boundaries.
- [`AI_WORKFLOW.md`](AI_WORKFLOW.md) — how every AI feature actually works: the real system
  prompts (quoted verbatim), the lesson-context builder, the AI-provider abstraction, error/
  fallback behavior, and rate limiting.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — production deployment steps for the database, backend,
  and frontend, plus a post-deploy checklist and a troubleshooting table.
- [`OPERATIONS.md`](OPERATIONS.md) — the API/worker process model, health endpoints, persistent
  uploads, backups, retention cleanup, and operational checks.
- [`VIDEO_GENERATION.md`](VIDEO_GENERATION.md) — Trainer and Trainee video workflows, grounded
  storyboards, TTS/Remotion rendering, draft lifecycle, publication, limits, and configuration.
- [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) — branch strategy, commit convention, PR expectations,
  and versioning strategy.
- [`TESTING_CHECKLIST.md`](TESTING_CHECKLIST.md) — automated checks plus the manual QA checklist,
  organized by feature area and re-run before any release.

Backend-specific error-handling conventions live in
[`../backend/docs/ERROR_HANDLING.md`](../backend/docs/ERROR_HANDLING.md) instead of here, since
they're specific to how the Express app is implemented, not the project as a whole.

The full system design lives in [`../ARCHITECTURE.md`](../ARCHITECTURE.md), at the `ai-lms/`
project root.
