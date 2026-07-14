// Service/repository contracts for the assessments module (enables mocking in tests).
// Intentionally empty: the one cross-module contract this module exposes —
// `AssessmentsRepository.isAccessibleToUser(assessmentId, userId)` — is consumed directly as a
// class method by the assessment-attempts module rather than through a shared interface here;
// keep its name/signature stable on the class itself (see assessments.repository.ts). Mirrors
// `CoursesRepository.isAccessibleToUser`'s precedent (see courses.interfaces.ts).
export {};
