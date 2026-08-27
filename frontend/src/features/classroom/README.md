# Classroom Feature

Course to Module to Lesson hierarchy, resources, and learner progress tracking.

Trainer resource management includes a feature-flagged AI Video Studio for grounded source
selection, asynchronous storyboard/render progress, editing, authenticated MP4 preview, and
explicit publication with the learner-reset warning.

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

The management screen is a shared course pool. Trainers see every published course plus their own
drafts. They may assign published catalogue courses to their active groups, but master course,
module, lesson, resource, and video-generation writes remain restricted to the creator (Super
Admins may manage all content). Assignment lists and counts are group-scoped for Trainers, so one
trainer never sees or changes another trainer's group delivery. Mandatory/optional is stored on
each course-to-group assignment; the course toggle is only the default for new assignments.

The trainee course page summarizes current lessons and resources completed. Its certificate card
remains visible but muted and disabled until every published lesson is complete at the current
content version; completion highlights and enables the print-ready SVG download. Certificates are
a lightweight presentation artifact, not a persisted credential registry or external verification
service.
