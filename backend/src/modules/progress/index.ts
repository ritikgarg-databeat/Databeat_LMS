export { default as progressRoutes } from './progress.routes';

// Also exported (beyond this module's own top-level router) so whichever engineer wires the
// lessons module can mount the lesson-scoped `GET`/`POST /lessons/:id/progress` endpoints
// directly on `lessons.routes.ts` — see README.md.
export { ProgressController } from './progress.controller';
export { progressValidation } from './progress.validation';
