// Request DTOs (API-facing shapes) for the dashboard module.
//
// Both endpoints (`GET /dashboard/trainee`, `GET /dashboard/trainer`) take no path params, no
// query params, and no request body — the caller's identity (`req.user`) is the only input, so
// there is nothing to type here. This file exists (empty of actual DTOs) purely to match the
// module file-set convention shared with qna/analytics; see dashboard.validation.ts likewise.
export {};
