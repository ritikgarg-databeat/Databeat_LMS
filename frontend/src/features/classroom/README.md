# Classroom Feature

Course to Module to Lesson hierarchy, resources, and learner progress tracking.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented authoring/learning flows include course duplication, module/lesson editing, safe
resource upload/removal, published trainee views, active-time tracking, new-content indicators,
version-aware completion, and the retryable 70% lesson quiz gate.
