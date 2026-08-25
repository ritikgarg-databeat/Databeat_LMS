# Trainer AI Lesson Video Generator

The trainer video studio creates lesson-centered animated explainers from the lesson title, optional description, and selected PDF, PPTX, DOCX, Markdown, code, and image resources. It is feature-flagged and disabled by default.

## Enable locally

1. Confirm the Remotion license that applies to the deployment.
2. Set `MAIN_OPENAI_API_KEY` and `VIDEO_GENERATION_ENABLED=true`.
3. Apply Prisma migrations and start the API and worker.

```bash
npm run prisma:migrate --prefix backend
npm run dev --prefix backend
npm run dev:worker --prefix backend
```

The worker must have persistent access to the same `UPLOAD_PATH` as the API plus Chromium/FFmpeg runtime prerequisites. Renderer failure does not affect LMS health or ordinary lesson/resource requests.

## Workflow

The lesson resource manager exposes **Generate Video** to trainers and Super Admins. A trainer selects supported evidence, adds up to 2,000 characters of creative direction, and chooses a 1–8 minute duration, language, voice, and fixed visual style. Trainer creative direction has the highest creative priority for audience, tone, examples, and emphasis. Without it, planning derives the teaching flow from the title, description, and selected content. Short lessons may be expanded with plain-language definitions, analogies, and clearly illustrative examples, but not invented organization-specific facts. The request creates an asynchronous job; the HTTP request never waits for OpenAI or rendering.

The worker generates a strict `VideoStoryboardV1` with the Responses API, including a target narration word budget and a varied sequence of short scenes. Every scene is validated against stable lesson source references. Trainers can edit narration, headings, bullets, layout type, planned duration, and order before approving rendering. Speech is generated once per scene and keyed by a versioned narration/voice/language hash. The worker measures each MP3 and replaces planned timing with frame-accurate audio timing before rendering, eliminating trailing pauses and keeping the next scene continuous. Captions are derived from approved narration and displayed as progressive phrases. Fixed Remotion layouts render kinetic titles, concept maps, processes, comparisons, timelines, diagrams, code reveals, callouts, and animated summaries as H.264/AAC MP4 at 1920×1080 and 30 FPS; model output is never executed as code.

Publishing rechecks the lesson fingerprint, copies the approved draft to `lesson-resources`, creates exactly one `VIDEO` resource, increments `contentVersion`, reopens completed lesson progress, and requires a current-version quiz. The copied file is rolled back if the transaction fails.

## Security and lifecycle

- Every endpoint requires Trainer or Super Admin role and the existing trainer course scope.
- Uploaded text is untrusted lesson evidence, not model instructions.
- Web search, external URLs, model-generated JavaScript, and external asset fetching are not used.
- Unsupported links, ZIP files, and existing videos are excluded from v1.
- A fingerprint mismatch marks the job `STALE` and blocks render/publish.
- One unpublished active job is allowed per trainer. Rendering defaults to one concurrent job.
- Failed renders retry twice. Cancellation and hierarchy deletion clean partial artifacts.
- Unapproved drafts expire after seven days by default.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VIDEO_GENERATION_ENABLED` | `false` | Exposes the studio and starts queue processing. |
| `VIDEO_STORYBOARD_MODEL` | `gpt-4o-mini` | Structured storyboard model. |
| `VIDEO_TTS_MODEL` | `gpt-4o-mini-tts` | Per-scene narration model. |
| `VIDEO_RENDER_CONCURRENCY` | `1` | Worker concurrency, hard-capped at 4. |
| `VIDEO_FRAME_CONCURRENCY` | `50%` | CPU threads used inside one Remotion render. Accepts `1`-`16` or `1%`-`100%`. |
| `VIDEO_MAX_DURATION_SECONDS` | `480` | Maximum approved storyboard duration. |
| `VIDEO_DRAFT_RETENTION_DAYS` | `7` | Unapproved draft retention. |
| `VIDEO_RENDER_TIMEOUT_MS` | `900000` | Child renderer timeout. |

## API

Routes are nested under `/api/v1/lessons/:id/video-generations`: `GET /sources`, `POST /`, `GET /`, `GET /:jobId`, `PATCH /:jobId/storyboard`, and `POST /:jobId/regenerate`, `/render`, `/publish`, or `/cancel`; `GET /:jobId/preview` streams an authenticated private draft.

Statuses are `PLANNING`, `STORYBOARD_READY`, `QUEUED`, `SYNTHESIZING`, `RENDERING`, `READY`, `PUBLISHED`, `FAILED`, `CANCELLED`, and `STALE`.
