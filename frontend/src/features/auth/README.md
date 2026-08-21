# Auth Feature

Login, logout, forgot/reset password, and session bootstrap flows.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented flows include login/remember-me, silent refresh, logout, forced and voluntary password
change, generic forgot-password confirmation, single-use reset-link handling, and role redirects.
