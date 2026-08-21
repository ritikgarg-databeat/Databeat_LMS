# Auth Module

Authentication, rotating sessions, forced password changes, and self-service password reset.

Layering: `auth.routes.ts` → controller → service → repository. Routes are mounted at
`/api/v1/auth`.

## Endpoints

- `POST /login`, `/logout`, `/refresh`
- `POST /forgot-password`, `/reset-password`
- `POST /change-password`
- `GET /me`, `POST /validate`

Access JWTs are returned to the SPA and kept in memory. Refresh JWTs are stored as httpOnly
cookies, hashed in `RefreshToken`, rotated on refresh, and linked by replacement id. Reuse of a
revoked token revokes every session for that user. Authentication middleware also reloads the
current active user/role so deactivation, role changes, and password-reset session revocation take
effect without waiting for the access token to expire.

Password-reset requests return the same response for known and unknown emails and include a
minimum response delay to reduce account enumeration. Reset tokens are random, hashed at rest,
single-use, and time-limited. Delivery uses `EMAIL_WEBHOOK_URL`; successful reset updates the
password atomically, consumes the token, and revokes existing refresh sessions.
