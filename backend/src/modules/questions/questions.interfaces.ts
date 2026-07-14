// Service/repository contracts for the questions module (enables mocking in tests).
// Intentionally empty: the one cross-module contract this module exposes —
// `QuestionsRepository.findByIdWithOptions(id)` — is consumed directly as a class method by the
// assessments module (built in parallel, Prompt 6) when snapshotting a bank question's current
// content into an AssessmentQuestion, rather than through a shared interface here; keep its
// name/signature/return shape stable on the class itself (see questions.repository.ts).
export {};
