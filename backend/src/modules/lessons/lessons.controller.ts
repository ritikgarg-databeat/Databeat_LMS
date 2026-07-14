import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateLessonDto,
  ListLessonsQueryDto,
  ReorderLessonsDto,
  UpdateLessonDto,
  UpdateLessonStatusDto,
} from './lessons.dto';
import { LessonsService } from './lessons.service';

// HTTP request handlers for the lessons module. No business logic here — see lessons.service.ts.
export class LessonsController extends BaseController {
  constructor(protected readonly service: LessonsService = new LessonsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const { moduleId } = req.query as unknown as ListLessonsQueryDto;
    const lessons = await this.service.list(moduleId);
    this.ok(res, lessons);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const lesson = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, lesson);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const lesson = await this.service.create(req.body as CreateLessonDto, req.user.id, req.ip);
    this.created(res, lesson, 'Lesson created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const lesson = await this.service.update(
      req.params.id as string,
      req.body as UpdateLessonDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, lesson, 'Lesson updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const lesson = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateLessonStatusDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, lesson, 'Lesson status updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.user.id, req.ip);
    this.noContent(res);
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.reorder(req.body as ReorderLessonsDto, req.user.id, req.ip);
    this.ok(res, null, 'Lessons reordered successfully.');
  };
}
