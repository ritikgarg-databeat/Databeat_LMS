# Impact Metrics

Read-only reporting layer over real usage logs — the "Measurable Early Impact" instrumentation
built in response to HackAdTech Checkpoint 1 feedback (7/20: numbers were projected, not
measured). Every report here is computed live from data other modules already write; nothing is
cached, projected, or backfilled with an assumption.

- `GET /impact-metrics/reports/auto-grading-latency?from=&to=` — submit-to-graded latency for
  attempts where every question was auto-gradable. 100% real historical data — no new
  instrumentation needed, this could be computed the day this endpoint shipped.
- `GET /impact-metrics/reports/ai-quiz-generation-latency?from=&to=` — real AI call latency,
  populated from `LessonQuizAttempt.generationDurationMs` (added alongside this module — reports
  `n: 0` until real quiz generations happen after that column exists).
- `GET /impact-metrics/reports/csv-import-speed?from=&to=` — populated from
  `AuditLog.metadata.durationMs` on `GROUP_BULK_IMPORT` entries (same "starts at zero" note).
- `GET /impact-metrics/pilot-dashboard?groupId=&from=&to=` — a `Group` treated as a pilot cohort:
  quiz-gate compliance (with any structural exception flagged as a bug, not hidden), quiz
  performance, manual-grading turnaround, and weekly-active percentage.
- `GET /impact-metrics/impact-report?from=&to=&groupId=` — assembles the above (plus
  `timing-observations`' stats) into one document. Every figure is labeled **validated**,
  **measured**, or **insufficient data** by `classifyConfidence` (constants/impact-report.ts) —
  the single place that decides whether a number has earned the word "validated". No other code
  in this module makes that call itself.

Every report shape returns `n` (and, where relevant, distinct-actor / date-span figures)
alongside the number it derives — never a bare average with no context on how much data backs it.
