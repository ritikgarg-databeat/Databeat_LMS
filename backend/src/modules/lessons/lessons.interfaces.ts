// Service/repository contracts for the lessons module (enables mocking in tests).
// Intentionally empty: the resources/progress modules import `LessonsRepository` (see
// lessons.repository.ts) directly rather than through a shared interface — no cross-module
// consumer needs these shapes yet.
export {};
