# Timing Observations

Lets a Trainer/Super Admin log one real, self-timed comparison — how long they took writing a
lesson quiz by hand versus reviewing/approving the AI-generated one for the same lesson. This is
the human-timed half of "Measurable Early Impact" that usage logs alone can't produce (there's no
"manual quiz-writing" event to log automatically).

- `POST /timing-observations` — log one observation (lessonId, courseId, manualDurationSeconds,
  aiAssistedDurationSeconds, optional notes). Validates the lesson actually belongs to the course.
- `GET /timing-observations` — paginated list, filterable by lesson/course/trainer/date range.
- `GET /timing-observations/stats` — live-computed stats (n, distinct trainers, distinct lessons,
  mean/min/max for manual/AI-assisted/saved time) over whatever rows match the same filters.
  Returns explicit `null`s when `n` is 0 — never a placeholder number.

This table's numbers feed the Impact Report generator (`impact-metrics` module) as one of the
inputs `classifyConfidence` weighs before calling anything more than "measured".
