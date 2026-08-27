# Dashboard Feature

Role-focused landing dashboards shown after login. They aggregate read-only signals from existing
features and link users to the underlying workflows; they do not become a separate source of truth.

## Role experiences

- **Super Admin:** organization-wide KPI cards, pending grading, quick management actions, group
  analytics preview, learner leaderboard, AI insights and usage, report access, and platform
  operations.
- **Trainer:** the same decision-oriented learning signals restricted to active owned groups and
  assigned courses.
- **Trainee:** assigned-course progress, continue-learning actions, assessments, recommendations,
  events, and personal activity.

Shared staff widgets accept role-aware destination paths so Admin drill-downs remain inside Admin
routes and Trainer drill-downs remain inside Trainer routes.

## Loading behavior

- The initial staff view uses the single cached `/dashboard/trainer` aggregate; the backend applies
  organization-wide scope for Super Admin and active-group scope for Trainer.
- The Admin group preview renders at most eight rows to keep the landing page compact.
- AI-usage and platform-operation panels use viewport-deferred queries, so below-the-fold data does
  not delay the first useful dashboard view.
- TanStack Query and the backend dashboard cache prevent rapid navigation from repeating the
  aggregate work.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented dashboards aggregate live platform, staff-scope, and trainee-progress data with recent
activity, alerts, recommendations, and navigation to the underlying records.
