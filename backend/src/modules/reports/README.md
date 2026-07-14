# Reports Module

CSV report exports (Prompt 8) for staff: trainee progress, assessment results, group
summaries, and course summaries — computed live from the transactional tables and downloaded
as `text/csv` attachments.

Layering: `reports.routes.ts` → `reports.controller.ts` → `reports.service.ts` →
`reports.repository.ts` (see ARCHITECTURE.md §3.1). `reports.dto.ts` holds the query DTOs,
`reports.types.ts` the internal domain shapes, `reports.validation.ts` the express-validator
chains. The scaffold's `reports.interfaces.ts` was removed — nothing referenced it.

## Endpoints

All four are `GET`, require TRAINER or SUPER_ADMIN (`requireRole` at the router level), and
respond with `text/csv; charset=utf-8` + `Content-Disposition: attachment;
filename="<base>-YYYY-MM-DD.csv"` (UTC date). Responses deliberately bypass the JSON success
envelope — the body is the file itself.

| Endpoint | Query params | One row per |
|---|---|---|
| `/api/v1/reports/progress/export` | `groupId?`, `courseId?` | trainee-in-scope × accessible course |
| `/api/v1/reports/results/export` | `assessmentId?`, `groupId?` | assessment attempt by an in-scope trainee |
| `/api/v1/reports/groups/export` | — | group in scope |
| `/api/v1/reports/courses/export` | — | published course in scope |

## Column contracts

**Progress** (`progress-report-YYYY-MM-DD.csv`, sorted by trainee name, then course title):
`Trainee Name, Email, Department, Groups, Course, Lessons Completed, Total Lessons,
Completion %, Time Spent (hours), Last Activity`

- Accessible courses per trainee = PUBLISHED, non-deleted courses assigned via
  `CourseGroupAssignment` to ANY group the trainee belongs to — the progress module's rule
  (Prompt 5 § SECURITY), copied feature-locally (see `reports.repository.ts`).
- `Completion %` = round(COMPLETED published lessons ÷ published lessons in published
  modules × 100); `Time Spent (hours)` = Σ `timeSpentSeconds` ÷ 3600, 1 dp; `Last Activity` =
  max `lastViewedAt` (ISO 8601) or blank.
- `Groups` lists only the trainee's groups WITHIN the export scope (joined with `; `) — a
  trainer never sees another trainer's group names.
- `courseId` narrows to one course (404 if missing/soft-deleted; a DRAFT course simply
  yields no rows, since it's accessible to nobody).

**Results** (`assessment-results-YYYY-MM-DD.csv`, sorted by assessment title, then trainee
name): `Trainee Name, Email, Assessment, Status, Total Score, Percentage, Passed,
Time Spent (min), Submitted At`

- Every attempt by an in-scope trainee on a non-deleted assessment (including `IN_PROGRESS`
  ones — `Status` says which). `Passed` is `Yes`/`No`, blank while ungraded; `Percentage`
  blank while ungraded, else 1 dp; `Time Spent (min)` 1 dp; `Submitted At` ISO 8601 or blank.
- `assessmentId` narrows to one assessment (404 if missing/soft-deleted).

**Groups** (`groups-report-YYYY-MM-DD.csv`, sorted by group name):
`Group, Code, Department, Status, Trainees, Avg Completion %, Avg Score %, Active Last 7 Days`

- `Trainees` counts TRAINEE members only. `Avg Completion %` = mean (1 dp) over member
  trainees of each one's overall completion (same accessible-lessons formula as the progress
  export; 0 for a member with no accessible lessons); blank for an empty group. `Avg Score %`
  = mean (1 dp) of members' mean graded-attempt percentages; blank when no member has a graded
  attempt. `Active Last 7 Days` = members with `lastLogin` OR any `lastViewedAt` in the last
  7 days.

**Courses** (`courses-report-YYYY-MM-DD.csv`, sorted by course title):
`Course, Status, Assigned Trainees, Started, Completed, Completion Rate %, Avg Time Spent (hours)`

- PUBLISHED, non-deleted courses only — all of them for SUPER_ADMIN; for a TRAINER, those
  assigned to ≥ 1 of their groups, and all figures count only trainees from the trainer's own
  groups. `Assigned Trainees` = distinct TRAINEE members of the course's assigned (non-deleted)
  groups; `Started` = of those, ≥ 1 progress row on the course's published lessons;
  `Completed` = every published lesson COMPLETED (courses with zero published lessons never
  count); `Completion Rate %` = round(Completed ÷ Assigned × 100), 0 when nobody is assigned;
  `Avg Time Spent (hours)` = total time on the course's published lessons ÷ `Started`, 1 dp
  (0 when nobody started — averaging over never-started trainees would only dilute it).

## Security scoping (Prompt 8 § SECURITY)

- Routes: `authenticate` + `requireRole(TRAINER, SUPER_ADMIN)`.
- Data: every export runs through `ReportsService#resolveScopedGroupIds` — a TRAINER's scope
  is exactly the non-deleted groups with `Group.trainerId = actor.id` (ARCHIVED groups stay
  in scope: exports are where historical batches matter); SUPER_ADMIN's scope is every
  non-deleted group. Passing a `groupId` outside a trainer's scope is a 403 whether or not
  the group exists (existence is never leaked); a SUPER_ADMIN passing a nonexistent/deleted
  `groupId` gets a 404.

## No new CSV dependency

Serialization is hand-rolled in `src/utils/csv.util.ts` (RFC 4180: quoting/escaping, CRLF
records, UTF-8 BOM for Excel). The only CSV package in the project is `csv-parse`, which only
parses; a serializer is ~30 lines of fully-specified behavior, so a dependency would add
nothing but supply-chain surface.

## Known simplifications

- Everything is computed live per request from transactional tables (a handful of batched
  queries + in-memory aggregation per export). Deliberately NOT reading the analytics module's
  snapshot tables (built in parallel; exports must reflect live data) — if group/course sizes
  grow, the upgrade path is a batch job or reusing those snapshots, flagged in
  `reports.service.ts`.
- CSV bodies are built as a single string (`res.send`), not streamed — fine at this scale.
- The results export does not filter attempts to assessments assigned to the scope's groups:
  any attempt BY an in-scope trainee is included (an attempt only exists if the trainee could
  access the assessment when they took it).
- Member counts include deactivated (`isActive: false`) users — historical reporting keeps
  departed trainees visible.
