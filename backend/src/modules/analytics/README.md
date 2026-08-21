# Analytics Module (Prompt 8 — Learning Progress Engine)

Performance aggregation for trainee/trainer/admin dashboards: per-user performance snapshots,
group rollups, the leaderboard, course funnels, assessment question stats, and daily-activity
timelines/streaks.

## Architecture

```
analytics.routes.ts → analytics.controller.ts → analytics.service.ts ─┬→ analytics.repository.ts
                                                aggregation.service.ts┘        (all Prisma access)
                                                        │
                                                metrics-calculator.ts (pure math, no I/O)
```

- **`metrics-calculator.ts`** — pure, unit-testable functions: `percentage`, `mean`,
  `computeStreakDays`, `computePerformanceScore`, `computeDropOff`, plus the UTC-day helpers.
  No Prisma, no clock reads ("today" is always passed in).
- **`aggregation.service.ts`** (`aggregationService`) — the "Aggregation Jobs" layer and the
  ONLY writer of the analytics cache tables. The `ensure*` methods compute a missing cache row
  synchronously, serve an existing stale row immediately while refreshing it in the background,
  and deduplicate concurrent refreshes. `refreshAll` force-recomputes everything.
- **`analytics.service.ts`** (`analyticsService`) — read side: authorization, shaping, live
  group aggregates over member snapshots, zero-filled timelines.
- **`analytics.repository.ts`** — every Prisma query for both services (ARCHITECTURE.md §3.1).
  Like the progress module it queries the transactional models directly and carries a
  feature-local copy of the course-accessibility rule (reference copy:
  `progress.repository.ts#findAccessibleCourseIds`).

`analytics.interfaces.ts` was dropped, matching the other Prompt 7+ modules.

## Cache tables + TTL design

`UserDailyActivity`, `UserPerformanceSnapshot`, `CourseAnalyticsSnapshot`, and
`AssessmentAnalyticsSnapshot` are **caches, not sources of truth** — every row is derived from
immutable transactional timestamps/values and can be truncated and recomputed at any time.
On access, a missing snapshot is computed synchronously. A row older than
`ANALYTICS_SNAPSHOT_TTL_MS` (10 min) is served immediately and refreshed in the background;
fresh snapshots are served as-is. In-process refresh maps ensure simultaneous requests share one
recompute. Recomputes are idempotent window-rewrites (daily activity: delete range + re-insert,
in one transaction) or upserts. An all-zero daily marker prevents inactive users from repeatedly
running the same empty source queries.

`AggregationService#refreshAll` (exposed as `POST /analytics/refresh`, SUPER_ADMIN only) is the
"background processing ready" seam: a future scheduler/queue can call exactly this entry point
off the request path; the stale-while-refresh guards remain a request-path safety net.

## Security model (stricter than earlier modules — deliberate)

- **SUPER_ADMIN** sees everything.
- **TRAINER** sees ONLY groups where `Group.trainerId` is their id, and ONLY trainees who are
  members of those groups (list, detail, user analytics, leaderboard population and its
  `groupId` filter — a non-owned `groupId` is a 403).
- **TRAINEE** sees only their own data via `GET /analytics/me` (or `/users/:id` with their own
  id — `/users/:id` has no route-level role gate; the service enforces self-or-visible).

The same trainer ownership policy is now shared across content, dashboards, reports, progress,
and assessment grading. Course/assessment analytics also require creator or active assigned-group
scope; personal-performance data never becomes staff-wide merely because the actor is a trainer.

## performanceScore

Computed in exactly one place, `metrics-calculator.ts#computePerformanceScore`:

```
0.5 * completionPercentage + 0.4 * (averageScore ?? 0) + 0.1 * (min(activityEvents7d, 20) / 20 * 100)
```

rounded to 1dp. It is stored on `UserPerformanceSnapshot.performanceScore` and is the
leaderboard's primary sort key (ties: completionPercentage desc, then name asc).

## Endpoints (`/api/v1/analytics`)

| Route                                                      | Access                                      |
| ---------------------------------------------------------- | ------------------------------------------- |
| `GET /groups?departmentId=`                                | staff (trainer-scoped)                      |
| `GET /groups/:id`                                          | staff (403 if not the group's trainer)      |
| `GET /users/:id`                                           | self, SUPER_ADMIN, or the trainee's trainer |
| `GET /me`                                                  | any authenticated user                      |
| `GET /leaderboard?groupId=&departmentId=&courseId=&limit=` | staff (trainer-scoped population)           |
| `GET /courses/:id`                                         | staff (content-level)                       |
| `GET /assessments/:id`                                     | staff (content-level)                       |
| `POST /refresh`                                            | SUPER_ADMIN                                 |

## Known simplifications

- **Course `averageScore` is a population proxy** — assessments have no course linkage in this
  schema (standalone, group-assigned; Prompt 6), so it is the mean attempt percentage across
  the course's _assigned trainees_, not "scores on this course's assessments" (see
  `CourseAnalyticsSnapshot`'s schema doc comment).
- **Sequential per-user recompute loops** in `ensureUserSnapshots`/`refreshAll` — fine at this
  scale and flagged in-code as the background-job upgrade point (move the same per-user
  recompute onto a queue; no API change needed).
- **UTC day bucketing** — all daily activity, streaks, and timelines bucket by UTC calendar
  date (`toISOString().slice(0, 10)`); users in other timezones may see a day boundary offset.
- Per-day lesson _views_/time-spent aren't reconstructible (LessonProgress keeps only running
  totals), so daily activity tracks completions and time-spent lives on the snapshot — see
  `UserDailyActivity`'s schema doc comment.
