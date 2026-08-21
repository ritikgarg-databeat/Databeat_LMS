# Backend Error Handling Standards

Reference doc for how errors, validation failures, and API responses are shaped across the
Databeat LMS backend. Written during the Prompt 10 final audit — the standard described here
was already in place across the codebase; this doc records it so future modules stay consistent.

---

## 1. The `AppError` hierarchy

Defined in [`src/utils/app-error.ts`](../src/utils/app-error.ts). `AppError` is the base class for
every expected ("operational") failure — as opposed to a programmer error/bug. Throw a subclass;
never construct `AppError` directly outside this file.

| Class                     | HTTP status | Error code            | Typical use case                                                                                                 |
| ------------------------- | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BadRequestError`         | 400         | `VALIDATION_ERROR`    | Failed input validation (`assertValidRequest`), or a business-rule input problem (e.g. `endAt` before `startAt`) |
| `UnauthorizedError`       | 401         | `UNAUTHORIZED`        | Missing/invalid/expired auth token, or `req.user` unexpectedly absent                                            |
| `ForbiddenError`          | 403         | `FORBIDDEN`           | Authenticated, but not allowed to perform this action (RBAC / ownership checks)                                  |
| `NotFoundError`           | 404         | `NOT_FOUND`           | The requested resource doesn't exist (a repository lookup returned `null`)                                       |
| `ConflictError`           | 409         | `CONFLICT`            | Would violate a uniqueness rule (duplicate email/name/code)                                                      |
| `TooManyRequestsError`    | 429         | `RATE_LIMITED`        | Rate limit exceeded (rarely thrown directly — most rate limiting is middleware-level)                            |
| `ServiceUnavailableError` | 503         | `SERVICE_UNAVAILABLE` | A dependent feature is temporarily down (e.g. AI provider outage)                                                |

Every subclass takes an optional `message` (falls back to a sensible default in
[`src/constants/error-messages.ts`](../src/constants/error-messages.ts)); `BadRequestError` also
accepts a `details: unknown[]` array, used for field-level validation errors.

**Rule of thumb:** in a service method, if a lookup can come back empty and the caller has no
other way to react to that, throw `NotFoundError` immediately — don't let a `null` propagate into
a later `.property` access. Example (`users.service.ts`):

```ts
private async findOrThrow(id: string): Promise<User> {
  const user = await this.repository.findById(id);
  if (!user) throw new NotFoundError('User not found.');
  return user;
}
```

---

## 2. Response envelope

Every endpoint returns one of exactly two shapes, defined in
[`src/utils/api-response.ts`](../src/utils/api-response.ts) and enforced by
`BaseController`/`error.middleware.ts`. Controllers call `this.ok(res, data)` / `this.created(res,
data)` (never `res.json()` directly) for success; thrown `AppError`s are turned into the error
shape automatically by `error.middleware.ts`.

**Success** (`GET /health/live` example):

```json
{
  "success": true,
  "message": "Service is alive",
  "data": { "status": "alive", "timestamp": "2026-08-21T14:20:41.888Z" }
}
```

**Error** (`GET /api/v1/departments` with no auth token, live example):

```json
{
  "success": false,
  "message": "Authentication token was not provided.",
  "errors": []
}
```

`data` is only present on success; `errors` is only present on failure — the two shapes are never
mixed. List endpoints nest pagination metadata inside `data` (`{ items, meta: { page, pageSize,
total } }`) rather than adding new top-level envelope fields.

Every response also carries `x-request-id`. A valid incoming id is preserved; otherwise the
backend generates a UUID. Access and unexpected-error logs include the same id for correlation.

---

## 3. Operational vs. unexpected errors — the never-leak-internals rule

[`src/middleware/error.middleware.ts`](../src/middleware/error.middleware.ts) is the last
middleware in the chain and the single place every thrown error ends up:

1. **`err instanceof AppError`** — an expected, safe failure. Its own `statusCode` and `message`
   (and `details`, for validation errors) are returned to the client as-is.
2. **`err instanceof multer.MulterError`** — a file-upload limit violation (e.g. file too large).
   Treated as a 400 with Multer's own message, since it's a client mistake, not a server fault.
3. **Anything else** — an unexpected exception (a bug, a Prisma error, a third-party failure,
   etc.). This is:
   - **Logged in full server-side** via `logger.error('Unhandled error', { error: err.stack, path:
req.path, requestId: req.requestId, userId: req.user?.id })` — Winston writes this to
     `src/logs/error.log` (error-level only) and
     `src/logs/combined.log` (every level), plus the console outside production
     ([`src/utils/logger.ts`](../src/utils/logger.ts)).
   - **Returned to the client as a generic 500** — `{ success: false, message: "Something went
wrong on our end. Please try again shortly.", errors: [] }`. No stack trace, no error
     message, no internal detail of any kind reaches the response body.

**This is a hard production security requirement, not a style preference.** Stack traces and
internal error messages (Prisma query text, file paths, third-party API errors, etc.) must never
reach the client under any circumstance — they're a direct information-disclosure risk (schema
details, internal paths, library versions). The only way an error's own message reaches the
client is by being an `AppError`, which means a developer deliberately chose that message as safe
to expose.

---

## 4. Validation errors

[`src/utils/validation.util.ts`](../src/utils/validation.util.ts)'s `assertValidRequest(req)` runs
`express-validator`'s `validationResult(req)` and throws a `BadRequestError` (400) with the raw
`result.array()` as `details` if any chain failed. Call it as the first line of every controller
method whose route has a validation chain attached (including param-only checks like
`idParamValidator`, not just body validators).

Live example — `POST /api/v1/auth/login` with an invalid email and empty password:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":""}'
```

```json
{
  "success": false,
  "message": "Please check the submitted data and try again.",
  "errors": [
    {
      "type": "field",
      "value": "not-an-email",
      "msg": "Enter a valid email address.",
      "path": "email",
      "location": "body"
    },
    {
      "type": "field",
      "value": "",
      "msg": "password is required.",
      "path": "password",
      "location": "body"
    }
  ]
}
```

`errors` is `express-validator`'s native per-field array (`type`/`value`/`msg`/`path`/`location`) —
passed straight through, not remapped, so every validation failure across every module has an
identical shape.

---

## 5. Checklist — adding a new module

- [ ] Every mutating route (POST/PATCH/PUT/DELETE) has an express-validator chain in
      `<module>.validation.ts`, applied in `<module>.routes.ts` before the controller handler.
- [ ] Every controller method backed by a validation chain (body, query, **or param** — e.g.
      `idParamValidator`) calls `assertValidRequest(req)` as its first line.
- [ ] Controllers throw `AppError` subclasses for expected failures and call `this.ok`/`this.created`/
      `this.noContent` for success — never `res.status(...).json(...)` directly (that bypasses the
      envelope and the centralized error log).
- [ ] Every service method that loads a resource by id checks for `null` and throws `NotFoundError`
      before dereferencing it — don't let a missing row surface as an unhandled 500.
- [ ] Shared express-validator chains: if a chain is used bare in `create` and with `.optional()`
      in `update`, it **must** be a factory function (`() => body(...)`), not a shared `const` —
      `.optional()` mutates the chain in place, so a shared instance silently makes `create`'s
      field optional too. Only share a bare `const` when every use site treats it identically (see
      `calendar.validation.ts` / `courses.validation.ts` / `groups.validation.ts` for the
      established pattern).
- [ ] Repository methods never return a raw `User` (or other sensitive-field-bearing model) to a
      controller unmapped — pass it through `toSafeUser()` (auth/users) or an explicit Prisma
      `select`/`include` that omits `passwordHash`, token hashes, etc. Grep for `passwordHash` /
      `tokenHash` after adding a new module that touches `User` or `RefreshToken`.
- [ ] List endpoints that read from a `findMany` paginate (`skip`/`take` + a parallel `count`) —
      don't return an unbounded result set. An internal helper query scoped to a known-small set
      (e.g. "this trainer's own groups") doesn't need pagination; anything reachable as a
      general-purpose list endpoint does.
- [ ] New `AppError` use cases should reuse an existing subclass/`ErrorCode`; only add a new one in
      `app-error.ts` / `error-messages.ts` if none of the existing seven genuinely fit.
