// Service/repository contracts for the calendar module (enables mocking in tests).
// Intentionally empty: this module exposes no contract other modules consume directly
// (unlike e.g. CoursesRepository.isAccessibleToUser) — notifications flow outward via the
// standalone `notificationsService` singleton instead.
export {};
