import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateQuestionDto, ListQuestionsQueryDto, UpdateQuestionDto, UpdateQuestionStatusDto } from './questions.dto';
import { QuestionsService } from './questions.service';
import type { QuestionSortField, SortOrder } from './questions.types';

// HTTP request handlers for the questions module. No business logic here — see questions.service.ts.
export class QuestionsController extends BaseController {
  constructor(protected readonly service: QuestionsService = new QuestionsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as ListQuestionsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      {
        category: query.category,
        difficulty: query.difficulty,
        type: query.type,
        status: query.status,
        search: query.search,
      },
      page,
      pageSize,
      (query.sortBy as QuestionSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const question = await this.service.getById(req.params.id as string);
    this.ok(res, question);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.create(req.body as CreateQuestionDto, req.user.id, req.ip);
    this.created(res, question, 'Question created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.update(req.params.id as string, req.body as UpdateQuestionDto, req.user.id, req.ip);
    this.ok(res, question, 'Question updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateQuestionStatusDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, question, 'Question status updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.softDelete(req.params.id as string, req.user.id, req.ip);
    this.noContent(res);
  };
}
