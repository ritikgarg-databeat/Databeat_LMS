# Databeat LMS — Enterprise Architecture Document

**Status:** Implemented architecture, updated 2026-08-21. Future items are labelled explicitly.

---

## 1. Executive Summary

Databeat LMS is a single-tenant, role-based enterprise Learning Management System for corporate training. It is implemented as a modular monolith: one React SPA, a long-running Node.js/Express API, a separate scheduler worker built from the same backend, and PostgreSQL. Internal module/service/repository boundaries and provider abstractions keep future extraction possible without pretending the current deployment is already microservices or multi-tenant SaaS.

Three governing constraints shaped every decision below:

1. **5–10 year maintainability.** Every cross-cutting concern (storage, AI, notifications, auth) is defined behind an interface/provider abstraction so the underlying implementation (local disk → S3, one LLM vendor → another) can change without touching business logic or the database schema.
2. **Explicit RBAC and ownership scope.** The current `Role` enum has `SUPER_ADMIN`, `TRAINER`, and `TRAINEE`. Route middleware enforces coarse roles, while shared policy helpers and repository queries enforce active-group/resource ownership. Adding a new role is a schema/code change and must include a scope review.
3. **Boring, provable technology at the edges.** Postgres (Neon), JWT, Express, Prisma — nothing exotic in the foundation. The only area that is deliberately designed for churn is the AI layer, because that's the one part of the stack where the "best" vendor/model will change over the product's lifetime.

---

## 2. High-Level Architecture

```
                                   ┌───────────────────────────┐
                                   │        Client (SPA)        │
                                   │  React + Vite + TS + RQ    │
                                   └──────────────┬─────────────┘
                                                  │ HTTPS (Axios)
                                                  ▼
                                   ┌───────────────────────────┐
                                   │        API Gateway Layer   │
                                   │  Express + Helmet + CORS   │
                                   │  Rate Limiter + Morgan     │
                                   └──────────────┬─────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    ▼                             ▼                             ▼
        ┌───────────────────┐        ┌───────────────────────┐      ┌───────────────────┐
        │  Auth & RBAC       │        │  Domain Modules        │      │  Cross-Cutting     │
        │  Middleware        │        │  (Controller→Service   │      │  Services          │
        │                    │        │   →Repository)          │      │                    │
        └───────────────────┘        │  Users, Depts, Groups,  │      │  Storage Service   │
                                      │  Classroom, Course,     │      │  AI Service        │
                                      │  Assessment, Q&A,       │      │  Notification Svc  │
                                      │  Calendar, Analytics    │      │  Audit Log Service │
                                      └───────────┬────────────┘      └─────────┬──────────┘
                                                  │                              │
                                                  ▼                              ▼
                                      ┌───────────────────────┐      ┌───────────────────┐
                                      │   Prisma ORM Layer     │      │  Local Disk /       │
                                      │                         │      │  (Future: S3/R2)    │
                                      └───────────┬────────────┘      └───────────────────┘
                                                  ▼
                                      ┌───────────────────────┐
                                      │   Neon PostgreSQL      │
                                      └───────────────────────┘
                                                  ▲
                                                  │ (future) pgvector for AI RAG
                                      ┌───────────────────────┐
                                      │  AI Provider Adapter   │
                                      │  (Anthropic / OpenAI / │
                                      │   local model — swap-  │
                                      │   pable behind interface)│
                                      └───────────────────────┘
```

**Why a modular monolith and not microservices at launch:** three roles, one org unit at a time, and a small initial team. Microservices would add network-boundary complexity (service discovery, distributed transactions, duplicated auth) without a scaling problem that justifies it yet. The module boundaries inside the monolith are drawn exactly where a future service split would occur (Storage, AI, Notifications, Analytics), so extraction later is a deployment change, not a redesign.

---

## 3. System Design

### 3.1 Layering (Backend)

```
Route → Middleware (auth, validation) → Controller → Service → Repository → Prisma → DB
```

- **Controller:** HTTP concerns only — parse request, call service, shape response. No business logic.
- **Service:** All business rules, orchestration across repositories, transaction boundaries.
- **Repository:** Prisma queries only. Nothing outside the repository layer talks to Prisma directly. This is what lets us later replace Prisma/Postgres calls with caching or a different data source per-entity without touching services.

### 3.2 Layering (Frontend)

```
Route (React Router) → Page (feature) → Feature Components → Shared UI (shadcn) → API Layer (Axios + TanStack Query hooks)
```

Pages never call Axios directly — they call a typed `useXQuery`/`useXMutation` hook from the feature's `api/` folder. This keeps caching, invalidation, and error handling consistent and swappable (e.g., migrating to GraphQL later touches the hook layer only).

### 3.3 Multi-tenancy stance

The current schema is single-tenant: one company per deployment, with no `organizationId` column
or row-level tenant policy. Multi-tenancy remains a future product/schema project and must not be
claimed as implemented. A SaaS conversion would require tenant identity, query scoping/RLS,
tenant-aware uniqueness, migrations, operational isolation, and cross-tenant security tests.

---

## 4. Application Flow Diagrams (Text Form)

### 4.1 Authentication Flow

```
User → POST /api/v1/auth/login {email, password}
     → AuthController → AuthService
         → UserRepository.findByEmail()
         → bcrypt.compare(password, hash)
         → issue Access JWT (15 min by default; contains sub, role, mustChangePassword)
         → issue Refresh JWT (unique jti; full token hash stored in RefreshToken, 7/30 days)
         → set Refresh Token as httpOnly, Secure, SameSite=Strict cookie
         → return Access Token in JSON body (kept in memory on client, never localStorage)
     → AuditLogService.record("LOGIN_SUCCESS")
```

### 4.2 Trainee Completing a Lesson

```
Trainee opens Lesson → GET /api/v1/lessons/:id
  → lesson/resource/progress repositories enforce published course/module/lesson plus active-group assignment
  → viewer posts bounded time deltas only while visible/recently active (server caps each delta at 60s)

Trainee clicks "Mark Complete" → POST /api/v1/lessons/:id/progress {status: COMPLETED}
  → ProgressService checks the current Lesson.contentVersion
  → LessonQuizService generates/loads a grounded current-version quiz when enough readable theory exists
  → opaque evidence/provider failure pauses completion; genuinely short text may require no quiz
  → learner must pass at 70% (retry attempts are versioned and retained)
  → ProgressService records completedContentVersion and completedAt

Trainer changes lesson/resource content
  → contentVersion increments, completed progress reopens, hasNewContent becomes true
  → old quiz attempts remain historical but cannot satisfy the new version
```

### 4.3 Trainer Creates an Assessment

```
Trainer → Assessment Builder UI → POST /api/v1/assessments {config}
  → AssessmentService validates config (passing marks, timer, randomization rules)
  → bank questions are snapshotted into AssessmentQuestion rows
  → assessment is published and assigned to active Groups

Trainee starts → POST /api/v1/assessments/:id/attempts/start
  → AttemptService stores randomized presentation order and immutable server expiresAt
  → answer writes are rejected after expiry; worker finalizes abandoned attempts every minute
  → objective types auto-grade; subjective/code/file types stay PENDING_REVIEW
  → after any attempt exists, assessment scoring/structure is immutable
  → immediate results show after grading, or a trainer performs one-time result release
  → released learners receive an in-app notification
```

### 4.4 AI Tutor Chat (Lesson-Aware)

```
Trainee → AI Chat widget on Lesson page → POST /api/v1/ai/chat {lessonId, message, conversationId}
  → AIController → AIService
      → ContextBuilder fetches source-labelled live lesson evidence and rechecks access
      → PromptManager requires ANSWER/REFUSE plus permitted evidence ids
      → common personal identifiers/credentials are redacted from the outbound copy
      → AIProvider.chat(...) performs a bounded request/response vendor call
      → PromptManager rejects malformed, unsupported, invented-evidence, and irrelevant output
      → AiRepository persists the original user turn and safe final assistant Markdown
```

---

## 5. Folder Structure

Current repository roots:

```text
ai-lms/
├── backend/
│   └── src/
│       ├── config/          environment, Prisma, CORS
│       ├── middleware/      auth/RBAC, request id/logging, rate limits, uploads, errors
│       ├── modules/         26 vertical domain modules
│       ├── policies/        active-group and trainer-resource scope
│       ├── repositories/    shared repository base/audit repository
│       ├── services/        audit, password-reset delivery, PostgreSQL rate-limit store
│       ├── storage/         StorageProvider + LocalStorageProvider
│       ├── jobs/            reminder, expiry, optional retention + scheduler
│       ├── prisma/          schema, 17 migrations, seeds, invariant checker
│       ├── tests/           focused hardening regression suite
│       ├── app.ts           middleware/routes/health assembly
│       ├── server.ts        API process bootstrap
│       └── worker.ts        scheduler process bootstrap
├── frontend/
│   └── src/
│       ├── components/      UI primitives, shared components, layout
│       ├── features/        domain pages/components/hooks/services/types
│       ├── routes/          lazy route tree and guards
│       ├── services/api/    Axios and refresh handling
│       ├── providers/       auth/theme/query providers
│       └── store/           client-only Zustand state
├── docs/                    AI, deployment, operations, testing, git workflow
└── .github/workflows/       automated quality gate
```

Every backend feature follows routes → controller → service → repository → Prisma. Every frontend
feature keeps API service/hooks/types beside its pages/components, while cross-feature primitives
remain shared.

### 5.1 Legacy backend design sketch (historical; `/server` is now `/backend`)

```
server/
├── src/
│   ├── config/                 # env loading, constants, Prisma client singleton
│   ├── middlewares/             # auth.middleware, rbac.middleware, error.middleware,
│   │                             validate.middleware (zod), rateLimit.middleware, upload.middleware
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.validation.ts   (zod schemas)
│   │   │   └── auth.repository.ts
│   │   ├── users/
│   │   ├── departments/
│   │   ├── groups/
│   │   ├── classroom/            # courses, modules, lessons, resources
│   │   ├── assessments/
│   │   ├── question-bank/
│   │   ├── qna/
│   │   ├── calendar/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── reports/
│   │   ├── audit-logs/
│   │   └── settings/
│   ├── services/
│   │   ├── storage/               # StorageProvider interface + LocalStorageProvider
│   │   ├── ai/                    # AIProvider interface + adapters (anthropic.adapter.ts, ...)
│   │   ├── notification/          # NotificationChannel interface (in-app, email)
│   │   └── audit/
│   ├── shared/
│   │   ├── errors/                # AppError hierarchy, error codes
│   │   ├── utils/
│   │   ├── types/
│   │   └── constants/
│   ├── jobs/                       # background-job definitions (cron today, queue-ready later)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── app.ts                      # express app assembly (middleware order, route mounting)
│   └── server.ts                   # http server bootstrap
├── storage/                        # local file storage root (git-ignored)
│   └── <entityType>/<entityId>/<uuid>-<filename>
├── tests/
├── .env.example
└── package.json
```

Each `modules/*` folder is self-contained (routes, controller, service, repository, validation) so a module can be lifted into its own service later by moving one folder.

### 5.2 Legacy frontend design sketch (historical; `/client` is now `/frontend`)

```
client/
├── src/
│   ├── app/
│   │   ├── router.tsx               # route tree, lazy-loaded pages
│   │   ├── App.tsx
│   │   └── providers.tsx            # QueryClientProvider, ThemeProvider, AuthProvider
│   ├── features/                    # feature-based, mirrors backend modules
│   │   ├── auth/
│   │   │   ├── api/                 # axios calls + TanStack Query hooks
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── types.ts
│   │   ├── users/
│   │   ├── departments/
│   │   ├── groups/
│   │   ├── classroom/
│   │   ├── assessments/
│   │   ├── qna/
│   │   ├── calendar/
│   │   ├── ai-tutor/
│   │   ├── notifications/
│   │   └── analytics/
│   ├── layouts/
│   │   ├── DashboardLayout.tsx      # Sidebar + Header + content outlet
│   │   ├── AuthLayout.tsx
│   │   └── components/ (Sidebar, Header, Breadcrumbs, MobileNav)
│   ├── components/ui/               # shadcn/ui primitives (button, dialog, table, etc.)
│   ├── components/shared/           # EmptyState, ErrorState, LoadingSkeleton, DataTable
│   ├── lib/
│   │   ├── api-client.ts            # axios instance, interceptors (token refresh, error mapping)
│   │   ├── queryClient.ts
│   │   └── utils.ts
│   ├── hooks/                       # cross-feature hooks (useAuth, usePermission, useTheme)
│   ├── stores/                      # lightweight client-state (Zustand) — UI state only
│   ├── styles/                      # tailwind.css, theme tokens
│   └── types/                       # shared TS types/interfaces
├── public/
├── index.html
└── package.json
```

---

## 6. Database Entity Map & Rationale

The table below this current map is the original design proposal and contains entity names that
were not adopted. The implemented Prisma schema currently groups 42 models as follows:

| Domain                          | Implemented models                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/security               | `User`, `RefreshToken`, `PasswordResetToken`, `RateLimitBucket`, `AuditLog`                                                                       |
| Organization                    | `Department`, `ExperienceLevel`, `Group`, `GroupMember`                                                                                           |
| Classroom                       | `Course`, `CourseModule`, `Lesson`, `LessonResource`, `CourseGroupAssignment`, `LessonProgress`, `LessonQuizAttempt`                              |
| Assessment                      | `Question`, `QuestionOption`, `Assessment`, `AssessmentQuestion`, `AssessmentGroupAssignment`, `AssessmentAttempt`, `AssessmentAnswer`            |
| Calendar/notifications/settings | `CalendarEvent`, `CalendarEventAssignment`, `Notification`, `NotificationPreference`, `PlatformSettings`                                          |
| AI/Q&A                          | `AiConversation`, `AiMessage`, `QnaQuestion`, `QnaAnswer`, `QnaComment`, `QnaVote`, `QnaTag`, `QnaQuestionTag`, `QnaAttachment`                   |
| Analytics/impact                | `TimingObservation`, `UserDailyActivity`, `UserPerformanceSnapshot`, `CourseAnalyticsSnapshot`, `AssessmentAnalyticsSnapshot`, `AnalyticsInsight` |

Important implemented invariants: role is an enum on `User`; there is no Organization/Permission
model; assessment questions are snapshotted into `AssessmentQuestion`; answers belong to
`AssessmentAttempt`; lesson completion and quizzes carry content versions; calendar/Q&A shape
constraints are enforced by additive SQL migrations; uploaded bytes are not stored in Postgres.

### Original proposal (historical, not the current schema)

| Entity                 | Purpose                                                                                                                                                 | Key Relationships                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `User`                 | Single identity table for all humans in the system (Super Admin, Trainer, Trainee). One table, not three, so auth/session logic is uniform.             | Has one `Role` (via `roleId`), belongs to `Organization`, has many `RefreshToken`, `AuditLog`, `Notification` |
| `Role`                 | Named role (SUPER_ADMIN, TRAINER, TRAINEE)                                                                                                              | Many-to-many with `Permission` via `RolePermission`                                                           |
| `Permission`           | Atomic capability (`user:create`, `assessment:publish`, etc.)                                                                                           | M2M with `Role`                                                                                               |
| `RolePermission`       | Join table                                                                                                                                              | —                                                                                                             |
| `RefreshToken`         | Hashed refresh tokens, one row per active session/device, supports revocation                                                                           | Belongs to `User`                                                                                             |
| `Organization`         | Tenant boundary (single row at launch; future multi-tenant hook)                                                                                        | Root of all org-scoped data                                                                                   |
| `Department`           | Organizational grouping created by Trainer/Admin (e.g., "Engineering")                                                                                  | Has many `Group`, `User` (via `departmentId`)                                                                 |
| `Group`                | A cohort of trainees assigned to classrooms/assessments/events together                                                                                 | Belongs to `Department`; M2M with `User` via `GroupMember`; M2M with `Course` via `CourseAssignment`          |
| `GroupMember`          | Join table, trainee ↔ group                                                                                                                             | —                                                                                                             |
| `Course`               | Top of classroom hierarchy                                                                                                                              | Has many `Module`; M2M with `Group` via `CourseAssignment`; created by a `Trainer` (User)                     |
| `CourseAssignment`     | Which groups/trainees can access a course                                                                                                               | Links `Course` ↔ `Group` (or directly to `User` for ad-hoc assignment)                                        |
| `Module`               | Grouping of lessons within a course                                                                                                                     | Belongs to `Course`; has many `Lesson`                                                                        |
| `Lesson`               | Unit of content (video/pdf/markdown/etc.)                                                                                                               | Belongs to `Module`; has many `LessonResource`; has many `Progress`                                           |
| `LessonResource`       | A file/link/snippet attached to a lesson (metadata + path only)                                                                                         | Belongs to `Lesson`; references `FileAsset`                                                                   |
| `FileAsset`            | Storage-agnostic file metadata (mimetype, size, relative path, checksum)                                                                                | Referenced by `LessonResource`, `AssessmentQuestion` (file-upload type), `User` (avatar)                      |
| `Progress`             | Per-trainee, per-lesson tracking: status, time spent, last viewed, completedAt                                                                          | Belongs to `User` + `Lesson`                                                                                  |
| `Assignment`           | A gradable task attached to a lesson/module (distinct from Assessment — project-style work)                                                             | Belongs to `Lesson`/`Module`; has many `AssignmentSubmission`                                                 |
| `AssignmentSubmission` | Trainee's submitted work + trainer grade/feedback                                                                                                       | Belongs to `Assignment` + `User`                                                                              |
| `QuestionBank`         | Logical grouping/category of questions (by topic/course)                                                                                                | Has many `Question`                                                                                           |
| `Question`             | A single question: type (MCQ, multi-select, fill-blank, true/false, subjective, SQL, coding, file-upload), options, correct answer(s), difficulty, tags | Belongs to `QuestionBank`; used by `Assessment` via `AssessmentQuestion`                                      |
| `Assessment`           | A configured test: timer, passing marks, randomization flag, attempt limit                                                                              | Belongs to `Course`/`Module`; M2M with `Question` via `AssessmentQuestion`; assignable to `Group`             |
| `AssessmentQuestion`   | Join table (ordering, marks-per-question override)                                                                                                      | —                                                                                                             |
| `Attempt`              | A trainee's instance of taking an assessment; stores a **frozen snapshot** of the question set at attempt time                                          | Belongs to `Assessment` + `User`; has many `AttemptAnswer`                                                    |
| `AttemptAnswer`        | Trainee's answer per question in an attempt, plus auto/manual score                                                                                     | Belongs to `Attempt` + `Question`                                                                             |
| `Result`               | Aggregated outcome of an `Attempt` (score, pass/fail, evaluated by)                                                                                     | Belongs to `Attempt` (1:1)                                                                                    |
| `CalendarEvent`        | Event/meeting/live session/deadline/holiday/exam                                                                                                        | Created by `User` (trainer/admin); M2M with `Group` via `EventAssignment`                                     |
| `EventAssignment`      | Which groups/users an event applies to                                                                                                                  | —                                                                                                             |
| `QnaQuestion`          | Forum question                                                                                                                                          | Belongs to `User` (author), optionally to `Course`/`Lesson`; has many `QnaAnswer`, tags via `QnaTag`          |
| `QnaAnswer`            | Answer to a forum question, may be trainer-verified                                                                                                     | Belongs to `QnaQuestion` + `User`; has many `QnaComment`, `QnaUpvote`                                         |
| `QnaComment`           | Comment thread on a question or answer                                                                                                                  | —                                                                                                             |
| `QnaUpvote`            | Upvote record (prevents duplicate votes)                                                                                                                | Belongs to `User` + target                                                                                    |
| `QnaTag`               | Tag taxonomy for search/filter                                                                                                                          | M2M with `QnaQuestion`                                                                                        |
| `AiConversation`       | A chat thread between a trainee and the AI tutor                                                                                                        | Belongs to `User`, optionally scoped to `Lesson`/`Course`                                                     |
| `AiMessage`            | Individual turn in a conversation (role: user/assistant, content, tokenUsage)                                                                           | Belongs to `AiConversation`                                                                                   |
| `Notification`         | In-app notification record (type, payload, read/unread)                                                                                                 | Belongs to `User`                                                                                             |
| `AnalyticsSnapshot`    | Pre-aggregated rollups (daily learning hours, completion %, streaks) computed by background job, read by dashboards                                     | Belongs to `User` or `Group`/`Department` (polymorphic scope)                                                 |
| `AuditLog`             | Immutable record of security-relevant actions (login, role change, password reset, deletion)                                                            | Belongs to `User` (actor); references target entity type/id                                                   |
| `SystemSetting`        | Key-value platform configuration (branding, feature flags, password policy)                                                                             | Global, singleton-per-org                                                                                     |

**Implemented rationale for a single `User` table:** authentication, password reset, profile, and
session logic remain uniform. Role-specific behavior is driven by the `Role` enum plus route and
resource-scope policy, not separate user table shapes.

**Implemented assessment snapshot:** bank content is copied into `AssessmentQuestion` before an
attempt. Once attempts exist, definition/scoring edits lock so history cannot silently change.

---

## 7. ERD (Text Form)

Current high-level relationships:

```text
Department 1─* Group *─* User (GroupMember)
Group *─* Course (CourseGroupAssignment)
Group *─* Assessment (AssessmentGroupAssignment)

Course 1─* CourseModule 1─* Lesson 1─* LessonResource
Lesson *─* User (LessonProgress, version-aware)
Lesson *─* User (LessonQuizAttempt, contentVersion + attemptNumber)

Question 1─* QuestionOption
Assessment 1─* AssessmentQuestion
Assessment *─* User (AssessmentAttempt) 1─* AssessmentAnswer

User 1─* RefreshToken / PasswordResetToken / Notification / AuditLog
User 1─* AiConversation 1─* AiMessage
QnaQuestion 1─* QnaAnswer / QnaComment / QnaVote / QnaAttachment
```

### Original proposal ERD (historical, not the current schema)

```
Organization 1───* Department 1───* Group *───* User (via GroupMember)
                                        │
                                        └─* CalendarEvent (via EventAssignment, M2M)

User *───1 Role *───* Permission (via RolePermission)
User 1───* RefreshToken
User 1───* AuditLog (as actor)
User 1───* Notification
User 1───* AiConversation 1───* AiMessage

Group *───* Course (via CourseAssignment, M2M)
Course 1───* Module 1───* Lesson 1───* LessonResource *───1 FileAsset
Lesson 1───* Progress *───1 User
Lesson 1───* Assignment 1───* AssignmentSubmission *───1 User

Course 1───* Assessment *───* Question (via AssessmentQuestion) *───1 QuestionBank
Assessment 1───* Attempt *───1 User
Attempt 1───* AttemptAnswer *───1 Question
Attempt 1───1 Result

QnaQuestion *───1 User
QnaQuestion 1───* QnaAnswer *───1 User
QnaQuestion *───* QnaTag
QnaAnswer 1───* QnaComment
QnaQuestion/QnaAnswer 1───* QnaUpvote *───1 User

Group/Department/User ◄── AnalyticsSnapshot (polymorphic scope, computed async)
```

---

## 8. Module Dependency Diagram

```
                         ┌────────────┐
                         │   Auth     │◄──────────────────────────────┐
                         └─────┬──────┘                               │
                               │ (every module depends on Auth/RBAC)  │
        ┌──────────────────────┼───────────────────────┐             │
        ▼                      ▼                        ▼            │
   ┌─────────┐          ┌────────────┐           ┌─────────────┐     │
   │  Users   │◄─────────│ Departments │◄──────────│   Groups     │     │
   └────┬─────┘          └────────────┘           └──────┬──────┘     │
        │                                                 │            │
        ▼                                                 ▼            │
   ┌───────────────┐       ┌────────────────┐      ┌─────────────┐    │
   │  Classroom     │──────►│  File Mgmt      │      │  Calendar    │────┘
   │ (Course/Module/│       │  (Storage Svc)  │      └─────────────┘
   │  Lesson)       │       └────────────────┘
   └───────┬────────┘
           │
           ▼
   ┌───────────────┐      ┌────────────────┐
   │  Assessment    │─────►│  Question Bank  │
   └───────┬────────┘      └────────────────┘
           │
           ▼
   ┌───────────────┐
   │  Analytics /   │◄──── Q&A, Progress, Attempts, Calendar (all feed analytics)
   │  Reports       │
   └───────────────┘

   ┌───────────────┐      ┌────────────────┐
   │  AI Assistant  │─────►│  Classroom      │ (reads lesson content for context)
   │                │─────►│  Question Bank  │ (generates quiz/interview questions)
   │                │─────►│  Analytics      │ (reads weak-topic data for recommendations)
   └───────────────┘      └────────────────┘

   Notifications: fan-in from Assessment, Q&A, Calendar, Classroom, User Mgmt
   Audit Logs: fan-in from every module (write-only sink, no module depends on it)
```

**Rule enforced by this diagram:** dependencies only point "down/right." `Question Bank` never imports from `Assessment`. `Classroom` never imports from `Analytics`. This is checked in CI via an import-boundary lint rule (e.g., `eslint-plugin-boundaries`) so the dependency graph can't silently grow cycles as the team scales.

---

## 9. Authentication Architecture

- **Access Token:** HMAC-signed JWT, 15-minute default expiry. Payload: `sub` (userId), `role`, `mustChangePassword`, `iat`/`exp`. Kept in memory on the client, never browser storage.
- **Refresh Token:** separately signed JWT with `sub`, unique `jti`, and `rememberMe`. Its full SHA-256 hash and metadata are stored in `RefreshToken`; the token is delivered as an `httpOnly` cookie (Secure in production).
- **Rotation:** Every refresh issues a new refresh token and revokes the old one, linked via `replacedByTokenId`. If a revoked token is presented again (reuse), the entire token family is revoked and the user is forced to re-authenticate — this is the standard defense against stolen-refresh-token replay.
- **Current-state recheck:** authenticated requests reload the active user/current role. Deactivation, role changes, and password-reset session revocation therefore take effect without relying only on stale access-token claims.
- **Password storage:** bcrypt, cost factor 12 (tunable via env, re-hash-on-login if cost factor increases later).
- **Password reset:** forgot-password always returns the same response, generates a random single-use token for an active matching user, stores only its hash, and delivers the link through an optional authenticated webhook. Reset consumes the token atomically, updates the password, and revokes old sessions. Expiry defaults to 30 minutes and is configurable.

---

## 10. RBAC Design

Two layers, deliberately separate:

1. **Role middleware** — coarse identity (`SUPER_ADMIN`, `TRAINER`, `TRAINEE`) controls route categories and UI navigation.
2. **Resource scope policy** — services/repositories constrain records by creator, assigned active groups, trainer ownership, publication, and soft-delete state. Super Admin bypass is explicit per domain.

```
Middleware chain per protected route:
  authenticate (verify JWT, attach req.user)
  → requireRole('TRAINER', 'SUPER_ADMIN')
  → service/repository scope assertion for the target assessment/group/course
  → controller handler
```

There is no `Permission`/`RolePermission` table in the current schema. Adding a role such as
Department Manager requires explicit schema, route, policy, UI, and regression-test work.
`activeGroupScope`, `trainerCourseScope`, `trainerAssessmentScope`, and module-specific ownership
checks prevent archived groups or Trainer A's ownership from granting Trainer B access.

---

## 11. API Architecture

- **Base path & versioning:** `/api/v1/...`. Version bump (`/api/v2`) only on breaking contract changes; additive changes (new optional fields) ship within v1.
- **Resource naming:** plural route modules below `/api/v1`; relationship-owned resources are nested where their parent id is required (`/groups/:id/members`, `/lessons/:id/resources`, `/assessments/:id/attempts`).
- **HTTP verbs:** standard GET/POST/PATCH/DELETE plus PUT for assessment answer autosave.
- **Request format:** JSON or multipart form data with camelCase fields, validated at the route boundary with `express-validator` before controllers run.
- **Response envelope (success):**
  ```
  { "success": true, "message": "...", "data": <resource or paginated object> }
  ```
- **Response envelope (error):**
  ```
  { "success": false, "message": "human-readable summary", "errors": [ ...safe details ] }
  ```
  HTTP status and the standard envelope drive client handling. Internal stack traces, SQL details,
  and provider errors are logged server-side and never returned in production.
- **Pagination:** cursor-based for high-volume/append-mostly lists (Audit Logs, Notifications, Q&A feed); offset/limit (`page`, `pageSize`) for admin tables where jump-to-page UX matters (Users, Reports).
- **Auth requirement declaration:** every route file declares required permission(s) alongside the route definition (`router.post('/', authorize('course:create'), ...)`), so the permission model is discoverable by reading routes, not by hunting through service code.
- **File endpoints:** uploads use multipart + disk-temporary Multer handling, size/type/signature
  validation, and the storage provider. PostgreSQL stores metadata plus a relative pointer.
  Downloads stream through the provider with safe disposition; they are not loaded fully into
  application memory.

---

## 12. State Management Strategy (Frontend)

Two clearly separated kinds of state, never mixed:

| Kind                                              | Tool                                     | Examples                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server state** (anything from the API)          | TanStack Query                           | courses, users, assessments, analytics — all fetched, cached, invalidated, and re-fetched via Query hooks. Mutations use `useMutation` + targeted `invalidateQueries`. |
| **Client/UI state** (never persisted server-side) | Zustand (lightweight) + local `useState` | sidebar collapsed/expanded, active theme, multi-step form wizard step, modal open/closed                                                                               |

**Why not Redux:** with TanStack Query owning all server data (including its own cache, loading/error states, and background refetch), a global store is only needed for a small amount of pure UI state — Zustand covers that with far less boilerplate. Auth identity (current user, permissions) lives in a small `AuthProvider` context backed by a Query hook (`useCurrentUser`), not duplicated into a separate store.

Forms: React Hook Form + Zod resolver everywhere, with the same Zod schemas mirrored (not literally shared across the network boundary, but structurally matched) to the backend validation schemas, so client and server reject the same invalid input.

---

## 13. File Storage Architecture

```ts
interface StorageProvider {
  save(input: {
    buffer?: Buffer;
    tempPath?: string;
    originalName: string;
    entityType: string;
  }): Promise<StoredFilePointer>;
  copy(
    pointer: StoredFilePointer,
    originalName: string,
    entityType: string,
  ): Promise<StoredFilePointer>;
  getReadStream(pointer: StoredFilePointer): Promise<Readable>;
  delete(pointer: StoredFilePointer): Promise<void>;
  checkHealth(): Promise<void>;
}
```

- **`LocalStorageProvider` (implemented):** writes below `UPLOAD_PATH/<entityType>/` with generated
  safe filenames. Entity namespaces are validated and every resolved pointer must remain below the
  configured root. `checkHealth()` verifies the root is readable/writable for readiness.
- **PostgreSQL stores:** relative path, original filename, MIME type, size, and owning domain
  relation. File bytes remain outside PostgreSQL.
- **Upload path:** Multer writes to an OS temporary directory, modules validate allowlist/size and
  magic bytes, then the provider copies the file into durable storage and removes the temporary
  file on all paths.
- **Lifecycle:** resource deletion removes its file; lesson/course deletion collects descendant
  pointers and performs best-effort physical cleanup. Deep course duplication uses independent
  file copies. Failed cleanup is structured-log visible for manual retry.
- **Cloud path (future):** implement the same interface for S3/R2/Azure/GCS and backfill existing
  pointers. Shared/object storage is required before horizontally scaling API instances without a
  shared volume. Malware scanning is still a future integration and must not be claimed today.

---

## 14. AI Architecture

```ts
interface AIProvider {
  chat(input: {
    systemPrompt: string;
    history: { role: "user" | "assistant"; content: string }[];
    userMessage: string;
  }): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }>;
}
```

- **Isolation:** model calls use the shared `AiProvider` seam; tutor prompt/context policy lives in
  the AI module, while lesson-quiz and dashboard services own their distinct feature prompts.
  Controllers never import vendor SDKs.
- **Provider adapters:** OpenAI and Anthropic implementations are active and selected by
  `AI_PROVIDER`; the selected key/model are environment configuration.
- **Capabilities and how each maps to context:**
  | Capability                                            | Context assembled by AIService                                                                                                                                             |
  | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Lesson-aware chat                                     | source-labelled lesson description, Markdown/code and extracted PDF/DOCX/PPTX text, bounded conversation history                                                           |
  | Lesson summarization                                  | full lesson resource text/transcript                                                                                                                                       |
  | Topic explanation (Beginner/Detailed/Interview depth) | current lesson evidence or permitted learning scope                                                                                                                        |
  | Completion quiz                                       | current-version lesson evidence → private 4–5 question attempt; 70% pass; retries retained                                                                                 |
  | Practice questions/examples                           | the same grounded lesson or permitted course scope used by tutor chat                                                                                                      |
  | Weak-topic detection                                  | aggregated `AttemptAnswer` correctness grouped by `Question.tags` — this is a deterministic analytics computation, not an LLM call, feeding _into_ the AI layer as context |
  | Dashboard recommendations                             | aggregate completion/score/activity plus deterministic weak question category; heuristic fallback                                                                          |
- **Safety/cost controls:** per-user AI limits (shared PostgreSQL store in production), token usage
  on `AiMessage`, strict lesson/main-tutor scope prompts, an `ANSWER`/`REFUSE` parser that validates
  evidence ids, deterministic refusal for irrelevant or malformed responses, and high-confidence
  personal-data/credential redaction before provider calls.
- **Future RAG path:** Neon Postgres supports the `pgvector` extension — course/lesson content can be chunked and embedded into a `ContentEmbedding` table for semantic retrieval as the content library grows beyond what fits in a single prompt. Not required at launch; the `AIService.ContextBuilder` is the seam where this gets inserted later without touching controllers.

---

## 15. Notification Architecture

- **In-app delivery (implemented):** `NotificationsService.notify`/`notifyMany` is the shared write
  path into `Notification`. Per-user `NotificationPreference.mutedTypes` is checked before rows are
  created; bulk sends batch preference reads/writes.
- **Producers:** course/assessment assignment, assessment deadline/result release, Q&A answer and
  verification, calendar create/update, and trainer announcements.
- **Scheduling:** a separate worker runs deadline reminders daily and once at startup; listing
  notifications performs the same idempotent check as a safety net. Scheduled tasks use
  `noOverlap`.
- **Email boundary:** general notifications are in-app only. Password-reset delivery is a separate
  HTTPS webhook service with optional bearer auth, not a nodemailer channel in this module.
- **Future:** WebSocket/SSE delivery or additional channels can be layered onto the shared write
  path, but are not currently implemented.

---

## 16. Analytics Architecture

- **Write path:** domain events (lesson completed, attempt submitted, login) are the source of truth (derivable from `Progress`, `Result`, `AuditLog` tables — no separate event log needed at this scale).
- **Read path:** role-scoped Prisma aggregations compute dashboards/reports on demand. Missing
  snapshot rows are computed synchronously; stale rows are served immediately and refreshed in
  the background with in-flight deduplication. Dashboard AI insights return a cached or immediate
  heuristic result while optional provider enrichment runs in the background. There is no
  nightly analytics-rollup worker today.
- **Trainee metrics:** learning hours (sum of `Progress.timeSpentSeconds`), weekly progress delta, completion % (`completed lessons / assigned lessons`), scores (`Result` history), streaks (consecutive days with `Progress` activity), AI recommendations (from AI Service).
- **Trainer metrics:** active-group performance from `LessonProgress` and `AssessmentAttempt`,
  assessment score/pass/question statistics from snapshotted `AssessmentAnswer` rows, login and
  Q&A engagement, and UTC-bucketed learning trends.
- **Export:** Reports module reuses the exact same aggregation functions as the dashboards (single source of truth for numbers) and renders to CSV/PDF as a presentation-layer concern only.

---

## 17. Security Architecture

- **JWT/Refresh:** covered in §9.
- **Authorization:** covered in §10 (RBAC + scope guards).
- **Password hashing:** bcrypt; password complexity is enforced by route validation. Forced first
  change and single-use reset flows are server-side invariants.
- **File validation:** disk-temporary upload, size/type allowlists, magic-byte checks, generated
  filenames, and storage-root boundary enforcement (§13). Malware scanning is not yet integrated.
- **Rate limiting:** tiered global, login, and AI limits. Production uses a shared PostgreSQL
  bucket store; local development may use memory. Authenticated AI limits key by user.
- **Helmet:** standard secure headers (CSP, HSTS, X-Frame-Options, etc.); CSP configured to allow only the app's own origin plus the AI provider's API host for any client-side calls (though AI calls are proxied server-side by default, keeping API keys off the client entirely).
- **CORS:** allowlist of known frontend origins per environment; credentials enabled only for those origins (needed for the httpOnly refresh cookie).
- **Input validation:** `express-validator` at backend route boundaries and Zod/form validation in
  the frontend. Prisma handles normal data access. The readiness probe, rate-limit store, and
  invariant checker use tagged, parameterized Prisma raw SQL where the database operation is
  intentionally lower-level.
- **Audit logging:** security-relevant actions such as login/logout, password changes/resets, role
  and active-state changes, content/resource mutations, and assessment publishing/grading write
  immutable `AuditLog` rows. Audit logs are append-only at the application layer and have only a
  paginated Super Admin read endpoint.
- **Secure error responses:** production error middleware maps all unexpected exceptions to a generic `INTERNAL_ERROR` response; stack traces and DB error details are logged server-side (Morgan/structured logger) only, never returned to the client.
- **Secrets:** all credentials via `.env`/environment, never committed; `.env.example` documents required keys with placeholder values.
- **Request traceability:** every response carries a request id; structured request/error logs and
  safe error envelopes allow correlation without exposing internal details.

---

## 18. Performance Architecture

- **Lazy loading:** route-level code splitting via `React.lazy` + `React Router`'s data APIs; heavy feature bundles (Course Builder, Analytics charts) load only when navigated to.
- **Pagination:** enforced on high-volume lists; bounded relationship lists are scoped by parent.
- **Database indexing:** the Prisma schema declares explicit single/composite indexes on foreign
  keys and hot paths, including lesson progress, assessment attempts, group membership, and
  organization lookups. Production query plans should still be reviewed as real volume grows.
- **Query optimization:** repositories select only the columns/relations needed by each response;
  bulk relationship reads and Prisma relation loading are preferred over per-row query loops.
- **Code splitting:** Vite's default chunking plus manual `vendor` chunk separation for large libs (Recharts, Framer Motion) so they don't bloat the initial bundle for pages that don't use them.
- **File streaming:** covered in §13 — accepted uploads use temporary disk and downloads use read
  streams, avoiding full-file application-memory residency.
- **Caching strategy:** TanStack Query provides two-minute client-side staleness control.
  Server-side analytics snapshots use stale-while-refresh, `AnalyticsInsight` caches
  AI/heuristic recommendations, and the final role-scoped dashboard payload has a 60-second
  in-process cache with request deduplication. A five-second authenticated-user cache collapses
  each page's parallel security lookups. A Super Admin can force analytics refresh through
  `POST /analytics/refresh`. There is no nightly analytics worker or shared Redis cache today.
- **Database connections:** the long-lived API uses a bounded, pre-warmed PostgreSQL pool and a
  Neon pooled runtime endpoint. The scheduler worker has an independent single-connection pool,
  preventing API/worker startup from producing a remote authentication storm.
- **Background jobs:** a dedicated worker runs deadline reminders and expired-attempt finalization;
  optional security-token retention is opt-in. Critical jobs catch up on startup and cron tasks use
  `noOverlap`. A durable distributed queue remains future work.

---

## 19. Coding Standards

| Category                     | Standard                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders                      | `kebab-case` (`question-bank/`, `ai-tutor/`)                                                                                                                                                               |
| React components             | `PascalCase.tsx` (`CourseCard.tsx`); one primary component per file                                                                                                                                        |
| Hooks                        | `useCamelCase.ts` (`useCourseProgress.ts`), always prefixed `use`                                                                                                                                          |
| Backend services/controllers | `<name>.service.ts`, `<name>.controller.ts`, `<name>.repository.ts`, `<name>.routes.ts`, `<name>.validation.ts`                                                                                            |
| Database models (Prisma)     | `PascalCase` singular model names (`User`, `CourseAssignment`); `camelCase` fields; Prisma maps to `snake_case` table/column names via `@@map`/`@map` for SQL-side convention                              |
| Environment variables        | `SCREAMING_SNAKE_CASE`, grouped by prefix (`DB_*`, `JWT_*`, `AI_*`, `STORAGE_*`)                                                                                                                           |
| Git commits                  | Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`), scoped where useful (`feat(assessments): add randomization`)                                                                       |
| Branches                     | `type/short-description` (`feat/qna-upvotes`, `fix/refresh-token-reuse`)                                                                                                                                   |
| Documentation                | Each module folder has a short `README.md` stating purpose, key entities, and non-obvious decisions; no docstring bloat on self-explanatory code                                                           |
| Comments                     | Only for non-obvious _why_ (a workaround, an invariant, a security-relevant constraint) — never restating _what_ well-named code already shows                                                             |
| API types                    | Shared TypeScript types for request/response DTOs live in a `types/` folder per module, imported by both the Zod schema and the frontend feature (via a shared package if a monorepo is adopted — see §22) |

---

## 20. Historical Development Milestones

This table records the original delivery sequence. It is not a list of missing features; current
behavior and operational boundaries are documented in the preceding sections and module READMEs.

| Milestone                         | Scope                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M0 — Foundation**               | Repo scaffolding, Prisma schema (all core entities), auth (login/JWT/refresh), RBAC middleware, base layout (Sidebar/Header/Theme), CI pipeline (lint/typecheck/test)                                              |
| **M1 — Identity & Org Structure** | User management (CRUD, disable, reset password), Departments, Groups, Group membership, Audit Logging wired to all of the above                                                                                    |
| **M2 — Classroom Core**           | Course/Module/Lesson CRUD, File upload + Storage Service (local provider), Progress tracking, learner-facing lesson viewer                                                                                         |
| **M3 — Assessment Engine**        | Question Bank, Assessment builder, Attempt flow (timer, randomization, snapshotting), Auto-evaluation for objective types, Results                                                                                 |
| **M4 — Engagement**               | Calendar (events, group assignment), Q&A Forum (questions/answers/comments/upvotes/tags/verification)                                                                                                              |
| **M5 — AI Layer**                 | AI Service + provider adapter, lesson-aware chat, summarization, quiz/interview-question generation (draft-to-QuestionBank flow)                                                                                   |
| **M6 — Analytics & Reporting**    | Trainee/Trainer dashboards, lazy TTL analytics snapshots, Reports export (CSV/PDF), in-app Notification Service                                                                                                    |
| **M7 — Hardening**                | Rate limiting tuning, security review pass, performance pass (indexing/query audit), accessibility audit, mobile responsiveness pass, Settings module, manual-evaluation flows for subjective/coding/SQL questions |
| **M8 — Launch Readiness**         | Load testing, backup/restore runbook, deployment pipeline, seed/demo data, admin onboarding docs                                                                                                                   |

This ordering is dependency-driven: Assessments need Question Bank and Classroom; AI needs Classroom content and Analytics' weak-topic data; Analytics needs real Progress/Attempt data flowing from M2/M3 to have anything meaningful to aggregate.

---

## 21. Risks and Mitigation

| Risk                                                                  | Impact                                                      | Mitigation                                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local file storage doesn't scale past a single server / no redundancy | Data loss, can't horizontally scale API servers             | Storage abstraction (§13) makes S3/R2 migration a config change, not a rewrite; document this as a pre-scale-out prerequisite, not an afterthought         |
| AI vendor pricing/availability/policy changes                         | Feature outage or cost spike                                | Provider-adapter pattern (§14); keep at least a second adapter designed (even if not implemented) as a documented fallback path                            |
| Question Bank edits silently invalidate historical results            | Compliance/trust issue (graded results should be immutable) | `Attempt` snapshotting (§6) — solved structurally, not procedurally                                                                                        |
| Role/scope sprawl as features grow                                    | RBAC and ownership rules become inconsistent                | Central active-group/trainer policy helpers, route-role review, and regression tests for every new role/resource path                                      |
| Refresh token theft (XSS or device compromise)                        | Account takeover                                            | httpOnly cookie + rotation + reuse detection (§9); short access-token TTL limits stolen-access-token window                                                |
| Analytics queries degrade dashboard performance as data grows         | Poor trainer/admin UX at scale                              | TTL snapshot tables and explicit refresh already separate derived data from sources of truth; move refresh work to a durable queue when volume requires it |
| A single API instance becomes a bottleneck                            | Downtime under load                                         | The API is stateless and shared rate limits live in PostgreSQL, but local uploads must move to shared object storage before horizontal API scaling         |
| Scope creep inside the monolith erodes module boundaries              | Future service extraction becomes impossible                | Import-boundary lint rule (§8) enforced in CI from M0                                                                                                      |

---

## 22. Future Scalability Roadmap

1. **Storage:** Local → S3/R2 via existing `StorageProvider` interface; add CDN in front of read paths for video/images.
2. **Background jobs:** `node-cron` → BullMQ + Redis for real job queues, retries, and scheduling UI (job functions unchanged).
3. **Caching:** Introduce Redis cache-aside at the Repository layer for hot, rarely-changing reads (Question Bank, Course catalog) once real traffic data justifies it.
4. **Search:** Postgres full-text search initially (Q&A, Course catalog); upgrade path to a dedicated search engine (e.g., Meilisearch/OpenSearch) if content volume/search UX demands it — isolated behind a `SearchProvider` interface analogous to Storage/AI.
5. **AI/RAG:** Add `pgvector`-backed embeddings for semantic lesson search and more accurate AI context retrieval as content library grows beyond prompt-window-friendly sizes.
6. **Multi-tenancy:** future schema/project work (§3.3), including tenant ids, uniqueness,
   resolution middleware, query enforcement/RLS, migration, and isolation tests.
7. **Service extraction:** AI Service and Notification Service are the two most likely first candidates for extraction into standalone deployables (independent scaling for LLM-bound latency and for email/push fan-out), enabled by the module-boundary discipline established from M0.
8. **Real-time:** Notifications and Q&A currently poll; upgrade path to WebSocket/SSE for live updates (live session attendance, real-time Q&A) without changing the write-side domain logic.
9. **Mobile:** Responsive web at launch; the feature-based frontend architecture and typed API layer are structured so a React Native client could reuse the same API contracts and most of the `features/*/api` hook logic later.

---

## Historical Implementation Roadmap

This was the implementation sequence used to build the current modular monolith. It is retained
for history, not as a statement that the listed modules are still missing:

1. **Prisma schema** for all entities in §6 + initial migration + seed script (roles/permissions/one Super Admin).
2. **Backend foundation:** Express app assembly, error/validation middleware, Auth module (login, refresh, logout), RBAC middleware, Audit Log service.
3. **User/Department/Group modules** (Super Admin & Trainer flows).
4. **Frontend foundation:** Vite/TS/Tailwind/shadcn setup, layout shell (Sidebar/Header/Theme/Breadcrumbs), router with role-based route guards, Axios client + token-refresh interceptor, Auth pages.
5. **Storage Service (local provider) + File Management module**, then **Classroom module** (Course/Module/Lesson/Resources) end-to-end (backend + frontend).
6. **Question Bank + Assessment Engine** (build, attempt, auto-evaluate, results) end-to-end.
7. **Calendar** and **Q&A Forum** modules end-to-end.
8. **AI Service** (provider adapter + lesson chat + generation features), wired into Classroom and Question Bank.
9. **Notification Service** + wire producers from steps 3, 6, 7, 8.
10. **Analytics + Reports**, including background-job aggregation.
11. **Settings module**, hardening pass (§17/§18 checklists), accessibility/responsive pass, deployment pipeline.

Each numbered step is a natural boundary for a dedicated implementation prompt in the next phase.
