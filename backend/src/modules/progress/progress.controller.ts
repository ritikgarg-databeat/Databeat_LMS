import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { ListContinueLearningQueryDto, UpsertLessonProgressDto } from './progress.dto';
import { ProgressService } from './progress.service';

const DEFAULT_CONTINUE_LEARNING_LIMIT = 5;
const MAX_CONTINUE_LEARNING_LIMIT = 20;

// HTTP request handlers for the progress module. No business logic here — see progress.service.ts.
export class ProgressController extends BaseController {
  constructor(protected readonly service: ProgressService = new ProgressService()) {
    super();
  }

  // Lesson-scoped: another engineer mounts this at `GET /lessons/:id/progress`, so
  // `req.params.id` resolves to the lessonId there (see README.md).
  getForLesson = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const progress = await this.service.getLessonProgress(req.params.id as string, req.user);
    this.ok(res, progress);
  };

  // Lesson-scoped: another engineer mounts this at `POST /lessons/:id/progress` (see README.md).
  upsertForLesson = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const progress = await this.service.upsertLessonProgress(
      req.params.id as string,
      req.user,
      req.body as UpsertLessonProgressDto,
    );
    this.ok(res, progress, 'Progress updated successfully.');
  };

  continueLearning = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListContinueLearningQueryDto;
    const limit = Math.min(MAX_CONTINUE_LEARNING_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_CONTINUE_LEARNING_LIMIT));
    const items = await this.service.getContinueLearning(req.user.id, limit);
    this.ok(res, items);
  };

  summary = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const summary = await this.service.getSummary(req.user.id);
    this.ok(res, summary);
  };

  courseProgress = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const breakdown = await this.service.getCourseProgress(req.params.courseId as string, req.user);
    this.ok(res, breakdown);
  };
}
