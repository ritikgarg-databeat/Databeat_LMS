# Notifications Feature

In-app notification center and per-user notification preferences.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented notification center includes unread counts, read/read-all/delete actions, assignment,
deadline, Q&A, announcement, and released-result navigation plus per-type preferences.
The background worker also creates weekly-deduplicated reminders for incomplete mandatory
training; the notification UI uses the existing course-assignment navigation behavior.
