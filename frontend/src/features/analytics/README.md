# Analytics Feature

Trainee and trainer performance dashboards, charts, and metrics.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented pages visualize course, group, user, and assessment analytics with role-scoped API
queries, loading/error states, charts, and drill-down navigation.

The shared live overview is presented as **Executive Learning Analysis** to Super Admins and
**Team Performance** to Trainers. It includes workforce reach, active adoption, mandatory
compliance, a clearly labelled potential annual LMS saving benchmark (₹3,000 per learner/year),
operational KPI cards, accessible chart/table twins, and direct course/group/assessment/report
drill-down actions. Trainer scope remains limited to active owned groups.
