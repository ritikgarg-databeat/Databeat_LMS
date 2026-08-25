# Video Generation Module

Trainer/Super-Admin scoped asynchronous lesson video generation. Routes are mounted under
`/lessons/:id/video-generations`; HTTP handlers only create/update jobs, stream private previews,
or publish completed artifacts.

`video-generation.worker.ts` claims PostgreSQL-leased jobs. Planning rebuilds selected lesson
evidence, verifies its fingerprint, and requests a strict source-referenced storyboard from the
specialized OpenAI adapter. The lesson title is always available as the minimum topic source;
trainer creative direction leads tone and examples, while short inputs may receive safe pedagogical
expansion. Rendering synthesizes one cached MP3 per scene, measures the real audio duration, aligns
scene and caption timing to 30 FPS, and invokes the animated Remotion composition in a memory- and
time-bounded child process. Model output is data only.

Drafts use separate storage namespaces and expire. Publication copies an approved MP4 into lesson
resource storage and atomically creates one `VIDEO` resource, advances `contentVersion`, and
reopens completed learner progress. See [`docs/VIDEO_GENERATION.md`](../../../../docs/VIDEO_GENERATION.md)
for configuration and operations.
