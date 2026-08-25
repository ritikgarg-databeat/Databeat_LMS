# Final Testing Checklist

Release QA checklist for Databeat LMS. The repository has a focused backend Node test suite and CI
checks, while the feature checklist below remains the manual browser/API acceptance pass. Wider
database integration and browser E2E automation are still recommended as the platform grows.

Every item below has already been exercised at least once via live curl/Playwright
verification during development (not just written from a template) — this checklist is meant
to be re-run before any future release, not just filed away. Check off each item against a
real running instance (seeded test accounts below) before shipping a new build.

**Seeded accounts** (from `npm run seed` + `npm run seed:demo`):

| Role         | Email                           | Password                                                     |
| ------------ | ------------------------------- | ------------------------------------------------------------ |
| Super Admin  | (per your `ADMIN_EMAIL`)        | (per your `ADMIN_PASSWORD`, forced to change on first login) |
| Demo Trainer | `ananya.rao@demo.databeat.lms`  | `DemoTrainer#2026`                                           |
| Demo Trainee | `rahul.verma@demo.databeat.lms` | `DemoTrainee#2026`                                           |

---

## Automated release gate

Run from the project root:

```bash
npm run typecheck
npm run lint
npm test --prefix backend
npm run build
```

The current backend suite covers active-group policy, assessment timer boundaries, lesson quiz
pass rules, trainer scope, AI answer/evidence guardrails, irrelevant-question refusal, outbound
sensitive-data redaction, upload magic-byte validation, independent storage copies, video source
fingerprints, synchronized caption cues, render retry policy, and trainee video quota rules. CI
runs the same checks on pushes/pull requests. A passing focused suite does not replace the
role-based manual workflow checks below.

---

## Authentication

- [ ] Login with correct credentials succeeds and redirects to the correct role dashboard.
- [ ] Login with wrong password shows a clear error, doesn't leak whether the email exists.
- [ ] A freshly-seeded Super Admin (never changed their password) is forced into the
      change-password flow immediately after login, and blocked from every other API call
      until it's done (verify by trying to navigate elsewhere — should redirect back).
- [ ] After changing the forced password, the user lands on their normal dashboard and every
      feature is accessible.
- [ ] "Remember me" checked at login produces a 30-day session (survives longer than a normal
      7-day session — check the refresh cookie's `Max-Age` in dev tools).
- [ ] Logout actually invalidates the session server-side (the old refresh token can't be
      replayed to get a new access token after logout).
- [ ] An expired/near-expired access token silently refreshes via the refresh cookie without
      forcing a re-login (no visible interruption while using the app).
- [ ] Voluntarily changing your password from Settings (not the forced first-login flow) works
      and doesn't log you out of your own current session.
- [ ] Directly navigating to `/admin`, `/trainer`, or `/trainee` while logged out redirects to
      `/login`.
- [ ] Forgot-password returns the same confirmation for an existing and nonexistent email; the
      configured webhook delivers a link for the real account, that link works once, and a second
      use is rejected. Existing sessions stop working after reset.

## Users

- [ ] Super Admin can create a Trainer account; the new trainer can log in with the assigned
      credentials.
- [ ] Super Admin/Trainer can edit a user's profile fields (name, department, experience level).
- [ ] Deactivating a user blocks their next login attempt with a clear "account disabled"
      message (existing sessions should also stop working, not just future logins).
- [ ] Reactivating a deactivated user restores login access.
- [ ] A Trainee cannot reach any user-management screen or API route (403, not a silent
      empty page).

## Departments & Groups

- [ ] Create a department, then a group inside it, with a trainer and experience level
      assigned.
- [ ] Assign trainees to a group (bulk-add and single-add both work).
- [ ] A Trainer can only manage groups they're assigned to (not every group in the org) where
      the feature is scoped that way (e.g. sending an announcement) — verify against a group
      that trainer does NOT own returns 403.
- [ ] Archiving/restoring a group works and is reflected immediately in list views.

## Classroom

- [ ] Create a course, add a module, add a lesson with content.
- [ ] Upload a lesson resource (file) and confirm it's downloadable by an assigned trainee.
- [ ] Assign a course to a group; a trainee in that group sees it on their dashboard/classroom
      page; a trainee NOT in that group does not.
- [ ] Trainee lesson-progress tracking updates as lessons are viewed/completed, and reflects
      correctly on both the trainee's own progress page and the trainer's group-analytics view.
- [ ] Add, edit, and remove lesson material after a trainee completed it: completion reopens, the
      lesson/course shows a new-content indicator, and the learner must pass a current-version
      quiz and mark complete again. Historical quiz attempts remain available in data.
- [ ] Learning time stops increasing while the tab is hidden or idle; an API delta above 60
      seconds is rejected/capped and cannot inflate the total.
- [ ] Deleting a resource, lesson, and course removes their physical files while files belonging
      to active or draft courses remain downloadable.

## Assessments

- [ ] Create an assessment, add questions from the question bank, assign to a group.
- [ ] A trainee in the assigned group can start an attempt, answer questions, and submit within
      the time limit.
- [ ] The browser timer matches server `remainingSeconds`; answer writes fail after `expiresAt`.
      With the learner page closed, the worker finalizes the attempt within the next scheduled
      scan and records the correct expiry reason.
- [ ] Auto-graded question types show a score immediately (if "show results immediately" is
      enabled); manually-graded types correctly show as pending until a trainer grades them.
- [ ] Trainer can view and grade pending manual-grading attempts; the trainee sees the final
      grade once graded.
- [ ] After any attempt exists, score/structure/question edits are blocked. With immediate results
      disabled, results stay masked until one-time release; release notifies affected learners.

## Calendar

- [ ] Create a calendar event and assign it to a department, group, or individual user (test at
      least one of each assignment type).
- [ ] The event appears on the calendar of every user actually covered by that assignment (and
      NOT for users outside it).
- [ ] Editing/rescheduling an event triggers an update notification to affected users (see
      Notifications section).

## AI Tutor

- [ ] Ask the AI a question from within a lesson — response is contextual to that lesson's
      content, not generic.
- [ ] Ask a lesson question unsupported by that lesson and unrelated trivia such as “What is the
      capital of India?”; lesson mode and main tutor respectively return the intended refusal.
- [ ] Conversation history persists and is retrievable on returning to the same lesson/chat.
- [ ] With the active provider's API key unset (`ANTHROPIC_API_KEY` or `MAIN_OPENAI_API_KEY`,
      depending on `AI_PROVIDER`), `/ai/chat` degrades gracefully (503 with a clear message)
      rather than crashing the whole app at boot or on request.
- [ ] A real provider-side error (rate limit, quota exceeded, etc.) surfaces as a clear,
      user-facing message ("receiving too many requests, try again shortly") instead of a blank
      screen or an infinite loading state.
- [ ] AI rate limiting kicks in appropriately under rapid repeated requests from the same user
      (doesn't block other users).
- [ ] Put a test email/phone/labelled API key in the prompt and verify the provider adapter receives
      redacted placeholders while the original user message remains in LMS conversation history.
- [ ] For a quiz-worthy lesson, provider failure pauses completion with a clear error. For an
      opaque file-only lesson, readable text/transcript is requested. A failed quiz can be retried,
      and only a score of 70% or higher allows completion.

## Trainer AI Lesson Video

- [ ] With the feature disabled, the LMS loads and the video studio stays hidden.
- [ ] A trainer selects supported evidence, edits/reorders the generated storyboard, renders in
      the background, and previews the authenticated MP4.
- [ ] Every factual scene has a selected source reference; unsupported files and title-only
      lessons are rejected.
- [ ] Content edits mark a job stale and block rendering/publication.
- [ ] Publishing creates one VIDEO resource, increments the content version, reopens completed
      trainees, and requires a current-version quiz.
- [ ] Cancellation, retries, expiry, and hierarchy deletion clean drafts without affecting LMS health.

## Trainee AI Lesson Video

- [ ] **Ask AI & Video** opens the tutor with the current lesson attached, and **Video** is hidden
      when no lesson is attached.
- [ ] A trainee can submit optional creative direction; the storyboard is approved automatically,
      renders in the background, and the private MP4 appears in the conversation without publishing
      a lesson resource or changing lesson progress.
- [ ] The video remains playable after leaving and reopening conversation history. Deleting the
      conversation cancels active work and removes its private video/audio artifacts.
- [ ] Super Admin can set the platform daily allowance from 0 to 20. A trainer can inherit that
      allowance or set a stricter one for active-group trainees; the lowest applicable limit wins
      and resets at midnight UTC.
- [ ] Reaching the limit returns a clear message. Retrying the same failed job does not consume a
      second allowance, and a trainee cannot run two video jobs simultaneously.
- [ ] Burned-in captions follow word timestamps from the generated audio. If transcription alignment
      is unavailable, the video renders without captions rather than displaying unsynchronized text.

## Q&A

- [ ] Ask a question (optionally scoped to a group/course/lesson) as a trainee.
- [ ] A trainer/eligible trainee can post an answer; the question's author is notified.
- [ ] A trainer can mark an answer as verified; the "verified" badge appears everywhere that
      answer is shown.
- [ ] Visibility rules hold: a question scoped to a specific group is not visible to users
      outside that group.

## Analytics

- [ ] Trainer dashboard shows real, correct aggregate numbers (trainee count, group count,
      average completion/score) matching what's actually in the data — not stale/cached
      incorrect values after a recent change.
- [ ] Reports export (CSV) succeeds and the exported data matches what's shown on-screen.
- [ ] A Trainee cannot access another trainee's individual analytics (403) but CAN see their own;
      a Trainer sees only trainees/content in their active assigned scope, while Super Admin has
      organization-wide access.

## Notifications

- [ ] Course/assessment assignment, upcoming deadlines, new Q&A answers, and trainer
      announcements each generate a notification for the right recipients.
- [ ] Releasing withheld assessment results generates an `ASSESSMENT_RESULTS_RELEASED`
      notification for learners with submitted attempts.
- [ ] Marking a notification read/unread and deleting it work and persist correctly.
- [ ] Muting a notification type in Settings actually suppresses future notifications of that
      type (confirmed: no new row created, not just hidden client-side) — and an announcement
      sent while muted correctly reports a lower "notified" count than the group's full size.

## Settings

- [ ] Theme preference (light/dark/system) persists across sessions and devices (stored
      server-side, not just localStorage).
- [ ] Avatar upload/removal works and the new avatar actually displays everywhere it should
      (header, profile page, settings) — not just accepted by the API with no visible change.
- [ ] Super Admin-only Platform Settings (platform name, support email, maintenance mode) are
      inaccessible (403) to Trainer/Trainee roles.
- [ ] Clearing a previously-set support email (leaving the field blank and saving) actually
      clears it rather than erroring or silently keeping the old value.
- [ ] Changing the platform trainee-video daily allowance is reflected in the trainer's inherited
      limit, and a trainer cannot save a custom value above the platform maximum.

## Audit Log

- [ ] Super Admin-only `/admin/audit-log` page loads and lists real historical events (login,
      user/group/course changes, assessment submissions, etc.), not empty or placeholder rows.
- [ ] Filtering by action type, actor, target, date range, and free-text search each narrow the
      results correctly; clearing filters returns to the full list.
- [ ] A Trainer or Trainee never sees this page or its API route (403, not a silent empty page).

## Maintenance Mode

- [ ] Toggling maintenance mode on (Platform Settings) blocks every subsequent Trainer/Trainee
      request immediately — including requests from a token issued _before_ the toggle, not just
      new logins — with a clear "platform is under maintenance" message.
- [ ] A Super Admin remains fully unaffected while maintenance mode is on.
- [ ] Login itself is blocked for non-Super-Admins while maintenance mode is on, with the same
      clear message (not a generic auth failure).
- [ ] Toggling maintenance mode back off immediately restores access with no need to re-login.

## Scheduled Reminders

- [ ] API runs with `RUN_SCHEDULER=false`; exactly one separate worker starts and logs the expiry
      and reminder jobs.
- [ ] Restarting the worker immediately runs catch-up checks rather than waiting for the next
      minute/day schedule.
- [ ] An assessment due within the reminder window generates a real, correctly-addressed
      deadline-approaching notification for each assigned trainee who hasn't yet submitted.
- [ ] Running the reminder job twice in a row never sends a duplicate notification for the same
      assessment/trainee pair.
- [ ] A slow job does not overlap its next scheduled execution.
- [ ] A trainee who opens their own notification list before the scheduled run still gets the
      reminder (the lazy, on-access check is a real safety net, not dead code).

## Measurable Impact Instrumentation

- [ ] A Trainer can log a real manual-vs-AI-assisted timing observation (course, lesson, both
      durations); the live stats view (`n`, distinct trainers, distinct lessons, mean/min/max)
      updates immediately and always shows `n` alongside every number — never a bare average.
- [ ] The pilot cohort dashboard, usage-derived metric reports (auto-grading latency, AI
      quiz-generation latency, CSV import speed), and the Impact Report generator all show
      "insufficient data" rather than a fabricated number when nothing has been measured yet for
      the selected scope/date range.
- [ ] No report or generated document uses the word "validated" for a figure that hasn't met the
      `classifyConfidence` thresholds (`MIN_N_FOR_VALIDATED`, `MIN_DISTINCT_TRAINERS_FOR_VALIDATED`,
      `MIN_PILOT_DAYS_FOR_VALIDATED` — `backend/src/constants/impact-report.ts`).
- [ ] A Trainer can only load the pilot dashboard for a group they're assigned to (or any group,
      if Super Admin) — a different Trainer's group returns 403, not another trainer's data.

## Cross-cutting

- [ ] Responsive layout holds at desktop, tablet, and mobile widths on the landing page, login,
      both dashboards, and at least one data table/form-heavy screen (no horizontal overflow,
      no unreadable/overlapping content).
- [ ] Keyboard-only navigation reaches every interactive element on the login page and the
      primary dashboard nav, with visible focus indicators throughout.
- [ ] No console errors during a full login → browse-every-major-section → logout cycle for
      each of the three roles (occasional benign items are expected and already documented as
      such: a `401` on `/auth/refresh` for an anonymous visitor's silent session-restore check
      is normal, not a bug).
- [ ] Production build (`npm run build` in both `frontend/` and `backend/`) completes cleanly
      with no errors, and the built frontend correctly calls the built backend end to end (not
      just the dev servers).
- [ ] `/health/live` returns 200 while the process is alive; `/health/ready` returns 200 only when
      PostgreSQL and the upload root are available.
