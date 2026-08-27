# Reports Feature

Exportable reports built on top of analytics aggregates.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented reporting offers role-scoped progress, assessment, group, course-completion, and
mandatory-compliance CSV exports. The compliance export distinguishes compliant, in-progress,
and not-started trainees and checks current lesson content versions.
