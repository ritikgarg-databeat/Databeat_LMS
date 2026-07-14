# Git Workflow

## Branch Strategy

Trunk-based, with short-lived feature branches:

- `main` — always deployable. Protected; merges only via reviewed pull request.
- `feat/<short-description>` — new functionality (e.g. `feat/assessment-timer`).
- `fix/<short-description>` — bug fixes (e.g. `fix/refresh-token-reuse`).
- `chore/<short-description>` — tooling, dependency bumps, config changes.
- `refactor/<short-description>` — internal restructuring with no behavior change.

Branches should be short-lived (days, not weeks). Rebase on `main` before opening a PR to
keep history linear and reviewable.

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/), optionally scoped to the
affected module/feature:

```
<type>(<scope>): <short summary>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style`.

Examples:
- `feat(assessments): add randomized question ordering`
- `fix(auth): rotate refresh token on reuse detection`
- `chore(deps): bump prisma to 7.9`
- `docs(architecture): clarify RBAC scope guard behavior`

## Pull Requests

- Keep PRs scoped to one concern — small PRs review faster and revert more safely.
- PR description should state the *why*, not just the *what* (the diff already shows what).
- CI (typecheck, lint, build) must pass before merge.

## Versioning Strategy

Semantic Versioning (`MAJOR.MINOR.PATCH`) once the platform starts shipping releases:

- **MAJOR** — breaking API contract change (see ARCHITECTURE.md §11 versioning: this usually
  coincides with an `/api/v2` bump, not a v1 breaking change).
- **MINOR** — new functionality, backward compatible.
- **PATCH** — bug fixes, no functional/API change.

Tag releases (`vX.Y.Z`) on `main` after a deploy is confirmed healthy. Until the first
production release, versions stay at `0.x.y` (frontend `package.json` reflects this) /
`1.0.0` internal builds (backend), per each package's own `version` field.
