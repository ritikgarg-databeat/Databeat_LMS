import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { SubmitLessonQuizDto } from './lesson-quiz.dto';
import { LessonQuizService } from './lesson-quiz.service';

// HTTP request handlers for the lesson-quiz module. No business logic here — see lesson-quiz.service.ts.
//
// Nested under the lessons module's router (`/lessons/:id/quiz`, `Router({ mergeParams: true })`
// — see lesson-quiz.routes.ts), so every handler here reads the lesson id off `req.params.id`,
// exactly like resources.controller.ts does.
export class LessonQuizController extends BaseController {
  constructor(protected readonly service: LessonQuizService = new LessonQuizService()) {
    super();
  }

  getOrGenerate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const view = await this.service.getOrGenerate(req.params.id as string, req.user);
    this.ok(res, view);
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.submit(req.params.id as string, req.user, req.body as SubmitLessonQuizDto);
    this.ok(res, result, 'Quiz submitted.');
  };
}
