# Dashboard Module

Two read-only aggregation endpoints — `GET /dashboard/trainee` and `GET /dashboard/trainer` —
compose data already owned by other modules into the exact payload shape the frontend foundation
was built against (`frontend/src/features/analytics/types/index.ts`). The staff endpoint serves
both Trainers and Super Admins: Trainer results are restricted to active owned groups, while Super
Admin results use organization-wide scope. It also includes an AI-generated recommendations block
with a graceful heuristic fallback cached in the `AnalyticsInsight` table.

The final per-user payload also has a 60-second in-process cache. Concurrent misses share one
promise, preventing duplicate browser requests and rapid route changes from repeating the full
cross-module query fan-out. Authentication and role checks still run on every HTTP request.

## Architecture

```
dashboard.routes.ts → dashboard.controller.ts → dashboard.service.ts ─┬→ dashboard.repository.ts
                                                                       ├→ analyticsService (analytics module)
                                                                       ├→ ProgressService (progress module)
                                                                       ├→ CalendarService (calendar module)
                                                                       ├→ AssessmentsService (assessments module)
                                                                       └→ dashboard-insights.service.ts → dashboard.repository.ts
```

This module is deliberately import-heavy — it is an AGGREGATOR, not a new source of truth. It
never duplicates a query another module's service already exposes; `dashboard.repository.ts`
only owns the `AnalyticsInsight` cache table plus a handful of queries that don't have a
reusable home elsewhere (see the field-source table below).

## Field → source table

### `GET /dashboard/trainee` → `TraineeDashboard`

| Field                                    | Source                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome.name/departmentName/groupNames` | `analyticsService.getMyAnalytics().user` (verbatim)                                                                                             |
| `welcome.streakDays`                     | `analyticsService.getMyAnalytics().streakDays`                                                                                                  |
| `welcome.overallCompletionPercentage`    | `analyticsService.getMyAnalytics().performance.completionPercentage`                                                                            |
| `continueLearning`                       | `ProgressService#getContinueLearning` (progress module), reshaped (drops `moduleId`)                                                            |
| `myCourses`                              | `analyticsService.getMyAnalytics().courses` (verbatim field names)                                                                              |
| `assessments.upcoming`                   | **Feature-local** `dashboard.repository.ts#findUpcomingAssessmentsForUser` — see "Known limitations"                                            |
| `assessments.averageScore/taken/passed`  | `analyticsService.getMyAnalytics().performance`                                                                                                 |
| `assessments.recentResults`              | `analyticsService.getMyAnalytics().recentAttempts` (capped to `DASHBOARD_RECENT_RESULTS_LIMIT`)                                                 |
| `upcomingEvents`                         | `CalendarService#listMine` (calendar module) — the exact method `UpcomingEventsWidget` calls, with the same 30-day window                       |
| `recommendations`                        | `dashboardInsightsService.getUserInsights` (this module)                                                                                        |
| `qnaActivity`                            | `analyticsService.getMyAnalytics().qnaActivity` (verbatim — already covers trainee Q&A engagement, no need to duplicate against the qna module) |

### `GET /dashboard/trainer` → `TrainerDashboard`

| Field                        | Source                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groups`                     | `analyticsService.getGroupsAnalytics(actor, {})`, re-exported verbatim                                                                                  |
| `overview.totalTrainees`     | **Feature-local distinct user count**: SUPER_ADMIN → all trainees; TRAINER → trainees in the trainer's active groups                                    |
| `overview.totalGroups`       | `groups.length`                                                                                                                                         |
| `overview.totalCourses`      | **Feature-local**: SUPER_ADMIN → all non-deleted courses; TRAINER → distinct courses assigned to their groups                                           |
| `overview.activeAssessments` | **Feature-local**: SUPER_ADMIN → all published assessments; TRAINER → distinct published assessments assigned to their groups                           |
| `overview.averageCompletion` | mean of `groups[].completionPercentage` (0 groups → 0)                                                                                                  |
| `overview.averageScore`      | mean of `groups[].averageScore`, nulls skipped (0 non-null scores → `null`)                                                                             |
| `leaderboard.items`          | `analyticsService.getLeaderboard({ limit: 10 }, actor)`                                                                                                 |
| `insights`                   | `dashboardInsightsService.getGroupInsights` for the staff scope's WORST-performing group — see "Insights scoping"                                       |
| `pendingGradingCount`        | `AssessmentsService#getStats(actor).pendingGradingCount` — Super Admin sees all; Trainer sees only assessments in their active creator/assignment scope |

## AI Insights (`dashboard-insights.service.ts`)

`AnalyticsInsight` (Prisma model, `scopeType: 'USER' | 'GROUP'`, unique on `[scopeType, scopeId]`)
is a **cache, not a source of truth** — same TTL-recompute pattern as the analytics module's
snapshot tables, reusing `ANALYTICS_SNAPSHOT_TTL_MS` (10 min) so both caches expire in lockstep.
On every call:

1. Look up the cached row for `(scopeType, scopeId)`. If `generatedAt` is within the TTL,
   return it as-is (fields already `{source, generatedAt, insights}`).
2. Otherwise, compute and persist heuristic insights immediately, then return them without
   waiting on an external AI provider.
3. If an AI provider is configured, launch one deduplicated background enrichment using the
   same compact analytics summary. A stale cached row is likewise served immediately while it
   refreshes in the background.
4. Upsert successful AI enrichment for later requests. Provider failures retain the heuristic
   result, and an unconfigured provider is skipped entirely.

### Weak-topic specificity — the honesty tradeoff

Neither `UserAnalytics` nor `GroupAnalyticsDetail` carries per-topic performance data, and there
is no sub-topic tagging anywhere in the schema — `Question.category` (`PYTHON`, `SQL`,
`STATISTICS`, `DATA_ANALYTICS`, `MACHINE_LEARNING`, `POWER_BI`, `EXCEL`, `SPARK`, `HADOOP`,
`GENERAL`) is the finest-grained tag that exists. So a claim like "struggling with SQL joins"
(the spec's own example) is **not derivable** from this data, and fabricating it would be
dishonest telemetry.

Instead, this module took option (b) from the brief: `dashboard.repository.ts#findWrongAnswerCategoriesForUsers`
queries the scope's own wrong (`isCorrect: false`) `AssessmentAnswer` rows, joined through
`AssessmentQuestion` to the bank `Question.category` (falling back to `'UNKNOWN'` when the bank
question was deleted — `AssessmentQuestion.questionId` is `SetNull`, mirroring analytics's
`AssessmentQuestionStat.category` convention). The category with the most wrong answers becomes
a real `WEAK_TOPIC` insight — but only once it crosses `MIN_WRONG_ANSWERS_FOR_WEAK_TOPIC` (2)
wrong answers, so a single unlucky question never produces a misleadingly confident claim. This
is a genuine signal, just coarser than "SQL joins" — it's "SQL" (category-level only).

The AI path is instructed (system prompt) never to invent specifics beyond what's in the data
summary handed to it, so it inherits the same honesty constraint rather than a model
hallucinating false precision the heuristic path deliberately avoids.

### Insights scoping — trainee vs. staff

- **Trainee** (`getUserInsights`): scoped to exactly that user (`scopeType: 'USER'`) — the
  natural unit for a personal dashboard.
- **Trainer/Super Admin** (`getGroupInsights`): a single `GROUP`-scoped insight is selected from
  the actor's authorized group scope. This module's `dashboard.service.ts#buildTrainerInsights`
  picks the WORST-performing group (lowest `completionPercentage`, tie-broken by lowest
  `averageScore`) and generates/caches ONE group-scoped insight for it —
  a "here's where to focus first" signal rather than either a diluted average-of-everything
  insight or N separate AI calls per dashboard load. The insight text always names the group
  (both the heuristic template and the AI prompt include `group.name`), so it reads as clearly
  scoped rather than ambiguous. A trainer with zero groups gets a static, uncached notice
  instead (there's no `scopeId` to key a cache row on).

## Known limitations (documented, not bugs)

- **`assessments.upcoming`** is a heuristic, not a first-class "assigned" concept: PUBLISHED,
  non-deleted, assigned to one of the user's groups, `dueDate` in the future, AND no
  `AssessmentAttempt` row yet for this user. An assessment with no `dueDate` never appears here
  (nothing to sort/threshold on) even if it's genuinely still open — it will still show up in
  `assessments.recentResults` once attempted, or via `/assessments/mine` directly.
- **Weak-topic specificity** — see the dedicated section above.

## Endpoints (`/api/v1/dashboard`)

| Route          | Access                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| `GET /trainee` | TRAINEE only (403 for TRAINER/SUPER_ADMIN — personal view, no "view as") |
| `GET /trainer` | TRAINER, SUPER_ADMIN                                                     |
