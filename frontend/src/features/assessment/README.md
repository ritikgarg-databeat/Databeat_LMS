# Assessment Feature

Question bank, assessment builder, timed attempts, and results.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented flows cover question-bank authoring, assessment configuration/duplication/publishing,
group assignment, server-timed trainee attempts with autosave, manual grading, result masking, and
one-time result release.
