import { Router } from 'express';

import { aiRateLimiter } from '@/middleware/ai-rate-limiter.middleware';
import { authenticate } from '@/middleware/auth.middleware';

import { LessonQuizController } from './lesson-quiz.controller';
import { lessonQuizValidation } from './lesson-quiz.validation';

/**
 * Route definitions for the lesson-quiz module. Meant to be mounted *inside* lessons.routes.ts at
 * `/:id/quiz` with `mergeParams: true` — mirrors exactly how resources.routes.ts is mounted at
 * `/:id/resources`. lessons.routes.ts uses `:id` (not `:lessonId`) as its own id param
 * throughout, so this router (and lesson-quiz.controller.ts) reads the lesson id off
 * `req.params.id` too.
 *
 * Both routes are reachable by any authenticated role — RBAC is enforced inside the service via
 * the self-contained lesson-accessibility check (Prompt 5 § SECURITY), since it depends on
 * course/group assignment, not just role. `GET /` sits behind `aiRateLimiter` (same per-user
 * limiter `/ai/chat` uses) since the first call for a given lesson/user is a real, billed LLM
 * request.
 */
const router = Router({ mergeParams: true });
const controller = new LessonQuizController();

router.use(authenticate);

router.get('/', aiRateLimiter, controller.getOrGenerate);
router.post('/submit', lessonQuizValidation.submit, controller.submit);

export default router;
