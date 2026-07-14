export { default as assessmentAttemptsRoutes } from './assessment-attempts.routes';

// Also exported so a wiring engineer can mount an extra endpoint directly on assessments.routes.ts
// if ever needed — mirrors the progress module's precedent (see README.md).
export { AssessmentAttemptsController } from './assessment-attempts.controller';
