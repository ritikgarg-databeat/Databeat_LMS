// Service/repository contracts for the courses module (enables mocking in tests).
// Intentionally empty: the one cross-module contract this module exposes —
// `CoursesRepository.isAccessibleToUser(courseId, userId)` — is consumed directly as a class
// method by the lessons/resources/progress modules rather than through a shared interface here;
// keep its name/signature stable on the class itself (see courses.repository.ts).
export {};
