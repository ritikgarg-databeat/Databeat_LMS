# Ai Feature

AI tutor chat, lesson summarization, and content generation features.

## Structure

- `components/` — feature-scoped React components (not shared elsewhere).
- `pages/` — route-level page components rendered by `routes/router.tsx`.
- `hooks/` — feature-scoped React hooks, including TanStack Query hooks.
- `services/` — API calls for this feature (Axios via `@/lib/api-client`).
- `types/` — TypeScript types/interfaces specific to this feature.
- `utils/` — pure helper functions specific to this feature.
- `constants/` — feature-scoped constant values (enums, option lists, etc).

Implemented pages/components include tutor chat, bounded conversation history, lesson entry
prompts, explanation-depth controls, guarded refusal rendering, delete-history actions, and an
answer-language selector for English, Hindi, Spanish, French, German, Portuguese, and Japanese.
Language selection applies to chat answers only and does not weaken lesson/domain guardrails.
