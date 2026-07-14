# Databeat LMS — Enterprise Architecture Document

**Phase 1: System Architecture & Technical Design**
**Status:** Design only — no application code included, per phase scope.

---

## 1. Executive Summary

Databeat LMS is a multi-tenant-ready (single-tenant at launch), role-based enterprise Learning Management System for corporate training. It is designed as a modular monolith on day one — a single deployable Node.js/Express service and a single React SPA — structured internally so that any module (Assessments, AI, Notifications, File Storage) can be extracted into an independent service later without touching unrelated code.

Three governing constraints shaped every decision below:

1. **5–10 year maintainability.** Every cross-cutting concern (storage, AI, notifications, auth) is defined behind an interface/provider abstraction so the underlying implementation (local disk → S3, one LLM vendor → another) can change without touching business logic or the database schema.
2. **RBAC that survives new roles.** Only three roles exist today, but the permission model is table-driven (`Role` ↔ `Permission`), not hardcoded `if (role === 'trainer')` checks scattered through the code. Adding "Manager" or "Auditor" later is a data change, not a code change.
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

Single-tenant at launch (one company per deployment), but every table that is org-scoped includes an `organizationId` column from day one, unused/fixed-to-one-row today. This is the cheapest possible insurance against a future "sell to multiple companies" pivot — retrofitting tenant isolation into a schema after the fact is materially more painful than including a nullable/default column now.

---

## 4. Application Flow Diagrams (Text Form)

### 4.1 Authentication Flow

```
User → POST /api/v1/auth/login {email, password}
     → AuthController → AuthService
         → UserRepository.findByEmail()
         → bcrypt.compare(password, hash)
         → issue Access Token (JWT, 15 min, RS256, contains userId, role, permissionsVersion)
         → issue Refresh Token (opaque random 256-bit token, stored hashed in RefreshToken table, 7-30 days)
         → set Refresh Token as httpOnly, Secure, SameSite=Strict cookie
         → return Access Token in JSON body (kept in memory on client, never localStorage)
     → AuditLogService.record("LOGIN_SUCCESS")
```

### 4.2 Trainee Completing a Lesson

```
Trainee opens Lesson → GET /api/v1/lessons/:id
  → LessonService.get(id) checks group/course assignment via GroupMember + CourseAssignment
  → returns Lesson + Resources + Progress record (create-if-absent, status=IN_PROGRESS)

Client tracks time-on-page → POST /api/v1/progress/:lessonId/heartbeat every N seconds
  → ProgressService accumulates timeSpentSeconds

Trainee clicks "Mark Complete" → POST /api/v1/progress/:lessonId/complete
  → ProgressService sets status=COMPLETED, completedAt=now
  → triggers CourseProgressRecalculation (module % → course %)
  → NotificationService (optional): notify trainer on milestone (e.g., course completed)
  → AnalyticsService: increment trainee's daily learning-hours rollup (async/background-job-ready)
```

### 4.3 Trainer Creates an Assessment

```
Trainer → Course Builder UI → POST /api/v1/assessments {courseId, config}
  → AssessmentService validates config (passing marks, timer, randomization rules)
  → QuestionBankService pulls/creates Questions (tagged by topic, difficulty, type)
  → Assessment linked to Course/Module and optionally to specific Groups

Trainee attempts → POST /api/v1/assessments/:id/attempts
  → AttemptService generates a randomized/frozen question set snapshot (stored on the Attempt,
    so later edits to the Question Bank never change a historical attempt)
  → timer enforced server-side (attempt has serverStartedAt + durationSeconds; late submits rejected)
  → submission → AutoEvaluationService scores objective types instantly;
    subjective/coding/SQL queued for ManualEvaluation (trainer) or AI-assisted pre-scoring
  → ResultService persists Result, triggers AnalyticsService + NotificationService
```

### 4.4 AI Tutor Chat (Lesson-Aware)

```
Trainee → AI Chat widget on Lesson page → POST /api/v1/ai/chat {lessonId, message, conversationId}
  → AIController → AIService
      → ContextBuilder: fetch lesson content + trainee's recent progress/weak topics
      → AIProviderAdapter.chat({systemPrompt, context, message}) — provider-agnostic interface
      → response streamed back via SSE/chunked response
      → ConversationRepository persists turn (for audit + "continue chat" later)
  → No AI call ever touches the DB directly — only via the same Service/Repository layers as
    everything else, so AI actions are auditable like any other user action.
```

---

## 5. Folder Structure

### 5.1 Backend (`/server`)

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

### 5.2 Frontend (`/client`)

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

| Entity | Purpose | Key Relationships |
|---|---|---|
| `User` | Single identity table for all humans in the system (Super Admin, Trainer, Trainee). One table, not three, so auth/session logic is uniform. | Has one `Role` (via `roleId`), belongs to `Organization`, has many `RefreshToken`, `AuditLog`, `Notification` |
| `Role` | Named role (SUPER_ADMIN, TRAINER, TRAINEE) | Many-to-many with `Permission` via `RolePermission` |
| `Permission` | Atomic capability (`user:create`, `assessment:publish`, etc.) | M2M with `Role` |
| `RolePermission` | Join table | — |
| `RefreshToken` | Hashed refresh tokens, one row per active session/device, supports revocation | Belongs to `User` |
| `Organization` | Tenant boundary (single row at launch; future multi-tenant hook) | Root of all org-scoped data |
| `Department` | Organizational grouping created by Trainer/Admin (e.g., "Engineering") | Has many `Group`, `User` (via `departmentId`) |
| `Group` | A cohort of trainees assigned to classrooms/assessments/events together | Belongs to `Department`; M2M with `User` via `GroupMember`; M2M with `Course` via `CourseAssignment` |
| `GroupMember` | Join table, trainee ↔ group | — |
| `Course` | Top of classroom hierarchy | Has many `Module`; M2M with `Group` via `CourseAssignment`; created by a `Trainer` (User) |
| `CourseAssignment` | Which groups/trainees can access a course | Links `Course` ↔ `Group` (or directly to `User` for ad-hoc assignment) |
| `Module` | Grouping of lessons within a course | Belongs to `Course`; has many `Lesson` |
| `Lesson` | Unit of content (video/pdf/markdown/etc.) | Belongs to `Module`; has many `LessonResource`; has many `Progress` |
| `LessonResource` | A file/link/snippet attached to a lesson (metadata + path only) | Belongs to `Lesson`; references `FileAsset` |
| `FileAsset` | Storage-agnostic file metadata (mimetype, size, relative path, checksum) | Referenced by `LessonResource`, `AssessmentQuestion` (file-upload type), `User` (avatar) |
| `Progress` | Per-trainee, per-lesson tracking: status, time spent, last viewed, completedAt | Belongs to `User` + `Lesson` |
| `Assignment` | A gradable task attached to a lesson/module (distinct from Assessment — project-style work) | Belongs to `Lesson`/`Module`; has many `AssignmentSubmission` |
| `AssignmentSubmission` | Trainee's submitted work + trainer grade/feedback | Belongs to `Assignment` + `User` |
| `QuestionBank` | Logical grouping/category of questions (by topic/course) | Has many `Question` |
| `Question` | A single question: type (MCQ, multi-select, fill-blank, true/false, subjective, SQL, coding, file-upload), options, correct answer(s), difficulty, tags | Belongs to `QuestionBank`; used by `Assessment` via `AssessmentQuestion` |
| `Assessment` | A configured test: timer, passing marks, randomization flag, attempt limit | Belongs to `Course`/`Module`; M2M with `Question` via `AssessmentQuestion`; assignable to `Group` |
| `AssessmentQuestion` | Join table (ordering, marks-per-question override) | — |
| `Attempt` | A trainee's instance of taking an assessment; stores a **frozen snapshot** of the question set at attempt time | Belongs to `Assessment` + `User`; has many `AttemptAnswer` |
| `AttemptAnswer` | Trainee's answer per question in an attempt, plus auto/manual score | Belongs to `Attempt` + `Question` |
| `Result` | Aggregated outcome of an `Attempt` (score, pass/fail, evaluated by) | Belongs to `Attempt` (1:1) |
| `CalendarEvent` | Event/meeting/live session/deadline/holiday/exam | Created by `User` (trainer/admin); M2M with `Group` via `EventAssignment` |
| `EventAssignment` | Which groups/users an event applies to | — |
| `QnaQuestion` | Forum question | Belongs to `User` (author), optionally to `Course`/`Lesson`; has many `QnaAnswer`, tags via `QnaTag` |
| `QnaAnswer` | Answer to a forum question, may be trainer-verified | Belongs to `QnaQuestion` + `User`; has many `QnaComment`, `QnaUpvote` |
| `QnaComment` | Comment thread on a question or answer | — |
| `QnaUpvote` | Upvote record (prevents duplicate votes) | Belongs to `User` + target |
| `QnaTag` | Tag taxonomy for search/filter | M2M with `QnaQuestion` |
| `AiConversation` | A chat thread between a trainee and the AI tutor | Belongs to `User`, optionally scoped to `Lesson`/`Course` |
| `AiMessage` | Individual turn in a conversation (role: user/assistant, content, tokenUsage) | Belongs to `AiConversation` |
| `Notification` | In-app notification record (type, payload, read/unread) | Belongs to `User` |
| `AnalyticsSnapshot` | Pre-aggregated rollups (daily learning hours, completion %, streaks) computed by background job, read by dashboards | Belongs to `User` or `Group`/`Department` (polymorphic scope) |
| `AuditLog` | Immutable record of security-relevant actions (login, role change, password reset, deletion) | Belongs to `User` (actor); references target entity type/id |
| `SystemSetting` | Key-value platform configuration (branding, feature flags, password policy) | Global, singleton-per-org |

**Why a single `User` table instead of separate `Trainer`/`Trainee` tables:** authentication, password reset, and profile logic would otherwise be duplicated three ways. Role-specific behavior is driven by `roleId` + the `RolePermission` table, not by table shape. This is the single highest-leverage decision in the schema for long-term maintainability — it's what makes "add a fourth role" a config change instead of a migration-plus-refactor.

**Why `Attempt` freezes a question snapshot:** if a trainer edits a question in the bank after trainees have already attempted an assessment using it, historical results must not silently change. The snapshot (stored as JSON on `Attempt`) guarantees `Result` integrity is permanent and auditable.

---

## 7. ERD (Text Form)

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

- **Access Token:** JWT, RS256, 15-minute expiry. Payload: `sub` (userId), `role`, `permissionsVersion`, `iat`/`exp`. Kept in memory on the client (a module-level variable in the API layer), never in `localStorage`/`sessionStorage`, to reduce XSS token-theft blast radius.
- **Refresh Token:** Opaque random value (not a JWT), stored **hashed** (SHA-256) in the `RefreshToken` table with `userId`, `expiresAt`, `revokedAt`, `replacedByTokenId`, `userAgent`/`ip` (for session listing/"log out other devices" later). Delivered as an `httpOnly`, `Secure`, `SameSite=Strict` cookie — never readable by JS.
- **Rotation:** Every refresh issues a new refresh token and revokes the old one, linked via `replacedByTokenId`. If a revoked token is presented again (reuse), the entire token family is revoked and the user is forced to re-authenticate — this is the standard defense against stolen-refresh-token replay.
- **`permissionsVersion`:** A counter on `Role`/`Organization`, bumped whenever role→permission mappings change. Access tokens embed the version at issue time; middleware compares it to the current version and rejects (403, forcing silent refresh) if stale — this lets us revoke *permissions*, not just sessions, without waiting 15 minutes.
- **Password storage:** bcrypt, cost factor 12 (tunable via env, re-hash-on-login if cost factor increases later).
- **Password reset (Trainer-initiated for Trainees, Admin for Trainers):** generates a single-use, time-boxed (1 hour) reset token, hashed at rest, emailed or shown to the initiating trainer/admin per org policy — never returned in a generic "success" response that leaks whether an email exists.

---

## 10. RBAC Design

Two layers, deliberately separate:

1. **Role** — coarse identity (`SUPER_ADMIN`, `TRAINER`, `TRAINEE`). Drives which parts of the UI/nav render.
2. **Permission** — fine-grained capability strings, e.g. `user:create`, `user:disable`, `department:create`, `course:publish`, `assessment:grade`, `analytics:view:department`, `settings:manage`. Roles are just named bundles of permissions (`RolePermission`).

```
Middleware chain per protected route:
  authenticate (verify JWT, attach req.user)
  → authorize('assessment:publish')  // checks req.user's role's permission set
  → scopeGuard('department')          // ensures target resource is within actor's dept/org (for Trainer)
  → controller handler
```

**Why not just `if (role === 'trainer')` checks:** those checks calcify — every new role requires touching every guarded route. With permission-bundle RBAC, introducing e.g. "Department Manager" (read-only analytics, no user management) is one row insert into `RolePermission`, zero code changes.

**Scoping beyond role:** a Trainer's permissions are further scoped to the departments/groups they manage (`scopeGuard` middleware checks the target record's `departmentId`/`groupId` against the trainer's assigned scope). Super Admin bypasses scope checks. This prevents "Trainer A can see Trainer B's group data" — a common LMS data-leak class of bug.

---

## 11. API Architecture

- **Base path & versioning:** `/api/v1/...`. Version bump (`/api/v2`) only on breaking contract changes; additive changes (new optional fields) ship within v1.
- **Resource naming:** plural, kebab-case nouns — `/api/v1/question-banks`, `/api/v1/calendar-events`. Nested resources only one level deep for readability: `/api/v1/courses/:courseId/modules`, not four levels of nesting; deeper relationships use query params (`/api/v1/lessons?moduleId=...`).
- **HTTP verbs:** standard REST semantics (GET/POST/PATCH/DELETE). PATCH for partial updates, PUT unused.
- **Request format:** JSON body, camelCase keys, validated at the route boundary via Zod schemas (`validate.middleware`) before the controller ever sees the payload.
- **Response envelope (success):**
  ```
  { "data": <resource or array>, "meta": { "page", "pageSize", "total" } }   // meta only on paginated list endpoints
  ```
- **Response envelope (error):**
  ```
  { "error": { "code": "VALIDATION_ERROR", "message": "human-readable summary", "details": [ ... field errors ... ] } }
  ```
  Error `code` is a stable machine-readable enum (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) the frontend can switch on without parsing message strings. Internal errors never leak stack traces or DB details in production responses (see §17).
- **Pagination:** cursor-based for high-volume/append-mostly lists (Audit Logs, Notifications, Q&A feed); offset/limit (`page`, `pageSize`) for admin tables where jump-to-page UX matters (Users, Reports).
- **Auth requirement declaration:** every route file declares required permission(s) alongside the route definition (`router.post('/', authorize('course:create'), ...)`), so the permission model is discoverable by reading routes, not by hunting through service code.
- **File endpoints:** uploads via `multipart/form-data` through Multer → validated (mimetype allowlist, size cap) → handed to the Storage Service → only the returned `FileAsset` metadata is persisted in Postgres. Downloads are streamed (`Content-Disposition`, range-request support for video) rather than loaded fully into memory.

---

## 12. State Management Strategy (Frontend)

Two clearly separated kinds of state, never mixed:

| Kind | Tool | Examples |
|---|---|---|
| **Server state** (anything from the API) | TanStack Query | courses, users, assessments, analytics — all fetched, cached, invalidated, and re-fetched via Query hooks. Mutations use `useMutation` + targeted `invalidateQueries`. |
| **Client/UI state** (never persisted server-side) | Zustand (lightweight) + local `useState` | sidebar collapsed/expanded, active theme, multi-step form wizard step, modal open/closed |

**Why not Redux:** with TanStack Query owning all server data (including its own cache, loading/error states, and background refetch), a global store is only needed for a small amount of pure UI state — Zustand covers that with far less boilerplate. Auth identity (current user, permissions) lives in a small `AuthProvider` context backed by a Query hook (`useCurrentUser`), not duplicated into a separate store.

Forms: React Hook Form + Zod resolver everywhere, with the same Zod schemas mirrored (not literally shared across the network boundary, but structurally matched) to the backend validation schemas, so client and server reject the same invalid input.

---

## 13. File Storage Architecture

```ts
interface StorageProvider {
  save(buffer: Buffer, meta: { entityType: string; entityId: string; originalName: string }): Promise<FileAssetPointer>
  getReadStream(pointer: FileAssetPointer, range?: { start: number; end: number }): Promise<ReadableStream>
  delete(pointer: FileAssetPointer): Promise<void>
  getSignedUrl?(pointer: FileAssetPointer, expiresInSeconds: number): Promise<string> // no-op locally, real for S3/R2
}
```

*(Interface shown for design clarity only — no implementation in this phase.)*

- **`LocalStorageProvider`** (launch implementation): writes to `storage/<entityType>/<entityId>/<uuid>-<sanitizedFilename>` on the application server's disk. Path traversal is prevented by generating the filename server-side (never trusting the client's original filename for the path) and validating `entityType` against an allowlist.
- **Postgres stores only:** relative path, original filename, mimetype, size, checksum (SHA-256, for integrity/dedup), uploader, `entityType`/`entityId`. Never binary content.
- **Swap path to cloud storage:** implement `S3StorageProvider`/`R2StorageProvider` against the same interface, flip one DI binding (`storageProvider = new S3StorageProvider(...)`), backfill existing files with a one-time migration script. Zero changes to controllers/services, because they only ever call `storageProvider.save()`/`getReadStream()`.
- **Validation:** MIME-type allowlist per upload context (lesson resources allow video/pdf/docx/pptx/image/zip/markdown; avatar uploads allow image only), max size per type, virus-scan hook point reserved (no-op today, pluggable later, e.g., ClamAV).
- **Video/large files:** served via streamed range requests (`Accept-Ranges`, `Content-Range`) so the browser can seek without downloading the whole file — works identically once swapped to S3 pre-signed URLs.

---

## 14. AI Architecture

```ts
interface AIProvider {
  chat(input: { systemPrompt: string; messages: ChatMessage[]; stream?: boolean }): Promise<AIResponse | AsyncIterable<AIChunk>>
  generateStructured<T>(input: { prompt: string; schema: JsonSchema }): Promise<T>  // for quiz/question generation
}
```
*(Interface shown for design clarity only — no implementation in this phase.)*

- **Isolation:** the AI Service is the *only* module allowed to construct prompts or call `AIProvider`. No controller ever talks to an LLM SDK directly — this is what makes the provider swappable and the usage auditable/rate-limitable in one place.
- **Provider adapters:** one adapter per vendor (e.g., an Anthropic Claude adapter) implementing the same `AIProvider` interface. Model/vendor selection is an environment variable, not a code branch.
- **Capabilities and how each maps to context:**
  | Capability | Context assembled by AIService |
  |---|---|
  | Lesson-aware chat | lesson content (markdown/transcript), trainee's recent Q&A on that lesson, conversation history |
  | Lesson summarization | full lesson resource text/transcript |
  | Interview question generation | course/module topic tags + difficulty target |
  | Quiz generation | lesson content + existing Question Bank (to avoid duplicates) → writes drafts into `QuestionBank` for trainer review, never auto-publishes |
  | Practice questions | trainee's weak-topic profile (from Analytics) |
  | Weak-topic detection | aggregated `AttemptAnswer` correctness grouped by `Question.tags` — this is a deterministic analytics computation, not an LLM call, feeding *into* the AI layer as context |
  | Personalized recommendations | weak-topic profile + course catalog + progress state |
- **Safety/cost controls:** per-user and per-org rate limiting on AI endpoints (separate, stricter limiter than general API), token-usage logging per `AiMessage` for cost accounting, and a system-prompt layer that constrains the assistant to the supplied lesson context (reducing hallucination and off-topic use on a corporate platform).
- **Future RAG path:** Neon Postgres supports the `pgvector` extension — course/lesson content can be chunked and embedded into a `ContentEmbedding` table for semantic retrieval as the content library grows beyond what fits in a single prompt. Not required at launch; the `AIService.ContextBuilder` is the seam where this gets inserted later without touching controllers.

---

## 15. Notification Architecture

```ts
interface NotificationChannel {
  send(notification: { userId: string; type: string; title: string; body: string; data?: object }): Promise<void>
}
```
*(Interface shown for design clarity only.)*

- **`InAppChannel`** (launch): writes to the `Notification` table; delivered to the client via polling (TanStack Query `refetchInterval`) at launch, upgradeable to WebSocket/SSE push later without changing the write path.
- **`EmailChannel`** (launch, for critical events only — password reset, assessment deadline reminders): nodemailer-based, templated.
- **`NotificationService.notify(userId, type, payload)`** fans out to whichever channels are enabled for that notification type per user/org preference (`SystemSetting`/per-user preference row) — a user can mute in-app "Q&A reply" notifications while keeping email for "assessment deadline," for example.
- **Producers:** Assessment (new assignment, deadline approaching, result published), Q&A (answer received, verified), Calendar (event starting soon), Classroom (new course assigned), User Management (password reset by admin).

---

## 16. Analytics Architecture

- **Write path:** domain events (lesson completed, attempt submitted, login) are the source of truth (derivable from `Progress`, `Result`, `AuditLog` tables — no separate event log needed at this scale).
- **Read path:** two tiers—
  1. **Real-time/on-demand:** simple counts/percentages computed directly via indexed Prisma queries for small scopes (a single trainee's dashboard, a single group).
  2. **Pre-aggregated (`AnalyticsSnapshot`):** a background job (nightly + on-demand trigger) rolls up expensive cross-entity aggregates — department-wide performance, org-wide learning trends — so trainer/admin dashboards never run heavy `GROUP BY` queries synchronously on request. Job runner is a simple `node-cron` scheduler at launch, structured so it can be lifted into BullMQ/Redis-backed queue workers later (see §18) without changing the job function bodies.
- **Trainee metrics:** learning hours (sum of `Progress.timeSpentSeconds`), weekly progress delta, completion % (`completed lessons / assigned lessons`), scores (`Result` history), streaks (consecutive days with `Progress` activity), AI recommendations (from AI Service).
- **Trainer metrics:** group/department performance (aggregated `Result`+`Progress` by `Group`/`Department`), assessment reports (score distribution, pass rate, per-question difficulty from `AttemptAnswer`), engagement (login frequency, Q&A participation), learning trends (rolling averages over `AnalyticsSnapshot`).
- **Export:** Reports module reuses the exact same aggregation functions as the dashboards (single source of truth for numbers) and renders to CSV/PDF as a presentation-layer concern only.

---

## 17. Security Architecture

- **JWT/Refresh:** covered in §9.
- **Authorization:** covered in §10 (RBAC + scope guards).
- **Password hashing:** bcrypt, cost 12; minimum password policy enforced via Zod (`SystemSetting`-configurable length/complexity).
- **File validation:** MIME allowlist + size caps + server-generated filenames (§13); uploaded files served with `Content-Disposition: attachment` for non-inline types to prevent stored-content XSS via HTML/SVG uploads.
- **Rate limiting:** tiered — global (per-IP) baseline via `express-rate-limit`, stricter limits on `/auth/*` (brute-force protection) and `/ai/*` (cost protection), keyed by user ID where authenticated.
- **Helmet:** standard secure headers (CSP, HSTS, X-Frame-Options, etc.); CSP configured to allow only the app's own origin plus the AI provider's API host for any client-side calls (though AI calls are proxied server-side by default, keeping API keys off the client entirely).
- **CORS:** allowlist of known frontend origins per environment; credentials enabled only for those origins (needed for the httpOnly refresh cookie).
- **Input validation:** Zod at every route boundary; Prisma parameterizes all queries (no raw SQL string concatenation — the "no raw SQL except where absolutely required" rule from the stack spec is satisfied by Prisma by default; any exception must go through a reviewed, parameterized `$queryRaw` with a documented justification).
- **Audit logging:** every security-relevant mutation (login, logout, password reset, role change, user disable/enable, permission change, file delete, assessment publish) writes an immutable `AuditLog` row: actor, action, target, timestamp, IP, before/after diff where relevant. Audit logs are append-only at the application layer (no update/delete endpoints exist for this table).
- **Secure error responses:** production error middleware maps all unexpected exceptions to a generic `INTERNAL_ERROR` response; stack traces and DB error details are logged server-side (Morgan/structured logger) only, never returned to the client.
- **Secrets:** all credentials via `.env`/environment, never committed; `.env.example` documents required keys with placeholder values.

---

## 18. Performance Architecture

- **Lazy loading:** route-level code splitting via `React.lazy` + `React Router`'s data APIs; heavy feature bundles (Course Builder, Analytics charts) load only when navigated to.
- **Pagination:** enforced server-side on every list endpoint (no "return all rows" endpoints); default + max page size capped in the validation schema.
- **Database indexing:** foreign keys indexed by default via Prisma relations; additional composite indexes on hot query paths — `(userId, lessonId)` on `Progress`, `(assessmentId, userId)` on `Attempt`, `(groupId, userId)` on `GroupMember`, `(departmentId)` on `User`/`Group`. Indexing strategy reviewed per-query during implementation using `EXPLAIN ANALYZE`.
- **Query optimization:** repositories select only needed columns/relations (no default `include: { everything: true }`); N+1 risks addressed via Prisma's relation-loading (`include`) planned per use case, not per-item loops.
- **Code splitting:** Vite's default chunking plus manual `vendor` chunk separation for large libs (Recharts, Framer Motion) so they don't bloat the initial bundle for pages that don't use them.
- **File streaming:** covered in §13 — large files (video) never fully buffered in server memory.
- **Caching strategy:** TanStack Query provides client-side cache/staleness control out of the box. Server-side: `AnalyticsSnapshot` pre-aggregation (§16) is the primary caching mechanism at launch; an HTTP-layer cache (e.g., Redis) is deferred until real load data justifies it, but the Repository layer's clean separation means adding a cache-aside layer later touches only repositories, not services/controllers.
- **Background jobs (future-ready):** job functions are written as pure, queue-agnostic units (`(payload) => Promise<void>`) invoked by a thin `node-cron` scheduler at launch. Swapping the scheduler for BullMQ/Redis later means changing the job *runner*, not the job *logic*.

---

## 19. Coding Standards

| Category | Standard |
|---|---|
| Folders | `kebab-case` (`question-bank/`, `ai-tutor/`) |
| React components | `PascalCase.tsx` (`CourseCard.tsx`); one primary component per file |
| Hooks | `useCamelCase.ts` (`useCourseProgress.ts`), always prefixed `use` |
| Backend services/controllers | `<name>.service.ts`, `<name>.controller.ts`, `<name>.repository.ts`, `<name>.routes.ts`, `<name>.validation.ts` |
| Database models (Prisma) | `PascalCase` singular model names (`User`, `CourseAssignment`); `camelCase` fields; Prisma maps to `snake_case` table/column names via `@@map`/`@map` for SQL-side convention |
| Environment variables | `SCREAMING_SNAKE_CASE`, grouped by prefix (`DB_*`, `JWT_*`, `AI_*`, `STORAGE_*`) |
| Git commits | Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`), scoped where useful (`feat(assessments): add randomization`) |
| Branches | `type/short-description` (`feat/qna-upvotes`, `fix/refresh-token-reuse`) |
| Documentation | Each module folder has a short `README.md` stating purpose, key entities, and non-obvious decisions; no docstring bloat on self-explanatory code |
| Comments | Only for non-obvious *why* (a workaround, an invariant, a security-relevant constraint) — never restating *what* well-named code already shows |
| API types | Shared TypeScript types for request/response DTOs live in a `types/` folder per module, imported by both the Zod schema and the frontend feature (via a shared package if a monorepo is adopted — see §22) |

---

## 20. Development Milestones

| Milestone | Scope |
|---|---|
| **M0 — Foundation** | Repo scaffolding, Prisma schema (all core entities), auth (login/JWT/refresh), RBAC middleware, base layout (Sidebar/Header/Theme), CI pipeline (lint/typecheck/test) |
| **M1 — Identity & Org Structure** | User management (CRUD, disable, reset password), Departments, Groups, Group membership, Audit Logging wired to all of the above |
| **M2 — Classroom Core** | Course/Module/Lesson CRUD, File upload + Storage Service (local provider), Progress tracking, learner-facing lesson viewer |
| **M3 — Assessment Engine** | Question Bank, Assessment builder, Attempt flow (timer, randomization, snapshotting), Auto-evaluation for objective types, Results |
| **M4 — Engagement** | Calendar (events, group assignment), Q&A Forum (questions/answers/comments/upvotes/tags/verification) |
| **M5 — AI Layer** | AI Service + provider adapter, lesson-aware chat, summarization, quiz/interview-question generation (draft-to-QuestionBank flow) |
| **M6 — Analytics & Reporting** | Trainee/Trainer dashboards, `AnalyticsSnapshot` background jobs, Reports export (CSV/PDF), Notification Service (in-app + email) |
| **M7 — Hardening** | Rate limiting tuning, security review pass, performance pass (indexing/query audit), accessibility audit, mobile responsiveness pass, Settings module, manual-evaluation flows for subjective/coding/SQL questions |
| **M8 — Launch Readiness** | Load testing, backup/restore runbook, deployment pipeline, seed/demo data, admin onboarding docs |

This ordering is dependency-driven: Assessments need Question Bank and Classroom; AI needs Classroom content and Analytics' weak-topic data; Analytics needs real Progress/Attempt data flowing from M2/M3 to have anything meaningful to aggregate.

---

## 21. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Local file storage doesn't scale past a single server / no redundancy | Data loss, can't horizontally scale API servers | Storage abstraction (§13) makes S3/R2 migration a config change, not a rewrite; document this as a pre-scale-out prerequisite, not an afterthought |
| AI vendor pricing/availability/policy changes | Feature outage or cost spike | Provider-adapter pattern (§14); keep at least a second adapter designed (even if not implemented) as a documented fallback path |
| Question Bank edits silently invalidate historical results | Compliance/trust issue (graded results should be immutable) | `Attempt` snapshotting (§6) — solved structurally, not procedurally |
| Role/permission sprawl as features grow | RBAC becomes as unmaintainable as hardcoded checks | Permission strings namespaced by module (`module:action`) from day one; periodic audit of `RolePermission` as part of each milestone's review |
| Refresh token theft (XSS or device compromise) | Account takeover | httpOnly cookie + rotation + reuse detection (§9); short access-token TTL limits stolen-access-token window |
| Analytics queries degrade dashboard performance as data grows | Poor trainer/admin UX at scale | Pre-aggregation via `AnalyticsSnapshot` background jobs designed in from M6, not retrofitted |
| Single Node.js process becomes a bottleneck | Downtime under load | Stateless API design (JWT auth, no in-memory session) means horizontal scaling behind a load balancer is possible without architectural change — only the local storage risk above needs resolving first |
| Scope creep inside the monolith erodes module boundaries | Future service extraction becomes impossible | Import-boundary lint rule (§8) enforced in CI from M0 |

---

## 22. Future Scalability Roadmap

1. **Storage:** Local → S3/R2 via existing `StorageProvider` interface; add CDN in front of read paths for video/images.
2. **Background jobs:** `node-cron` → BullMQ + Redis for real job queues, retries, and scheduling UI (job functions unchanged).
3. **Caching:** Introduce Redis cache-aside at the Repository layer for hot, rarely-changing reads (Question Bank, Course catalog) once real traffic data justifies it.
4. **Search:** Postgres full-text search initially (Q&A, Course catalog); upgrade path to a dedicated search engine (e.g., Meilisearch/OpenSearch) if content volume/search UX demands it — isolated behind a `SearchProvider` interface analogous to Storage/AI.
5. **AI/RAG:** Add `pgvector`-backed embeddings for semantic lesson search and more accurate AI context retrieval as content library grows beyond prompt-window-friendly sizes.
6. **Multi-tenancy:** `organizationId` already present on all org-scoped tables (§3.3); full SaaS multi-tenant rollout requires only tenant-resolution middleware (subdomain/header-based) and RLS or query-scoping enforcement — no schema redesign.
7. **Service extraction:** AI Service and Notification Service are the two most likely first candidates for extraction into standalone deployables (independent scaling for LLM-bound latency and for email/push fan-out), enabled by the module-boundary discipline established from M0.
8. **Real-time:** Notifications and Q&A currently poll; upgrade path to WebSocket/SSE for live updates (live session attendance, real-time Q&A) without changing the write-side domain logic.
9. **Mobile:** Responsive web at launch; the feature-based frontend architecture and typed API layer are structured so a React Native client could reuse the same API contracts and most of the `features/*/api` hook logic later.

---

## Prioritized Implementation Roadmap (Guides Remaining Prompts)

This is the sequence subsequent implementation-phase prompts should follow — each step assumes the prior step's contracts (schema, interfaces) are fixed:

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
