import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { ChatRequestDto, ListConversationsQueryDto } from './ai.dto';
import type { AiService } from './ai.service';
import { aiService } from './ai.service';

// HTTP request handlers for the ai module. No business logic here — see ai.service.ts.
export class AiController extends BaseController {
  constructor(protected readonly service: AiService = aiService) {
    super();
  }

  chat = async (req: Request, res: Response) => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const dto = req.body as ChatRequestDto;
    const result = await this.service.chat(dto, req.user);
    this.ok(res, result);
  };

  listHistory = async (req: Request, res: Response) => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as ListConversationsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);
    const result = await this.service.list(req.user.id, { lessonId: query.lessonId }, page, pageSize);
    this.ok(res, result);
  };

  getConversation = async (req: Request, res: Response) => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const conversation = await this.service.getConversation(req.params.id as string, req.user);
    this.ok(res, conversation);
  };

  /** Staff-only (route-gated) org-wide usage aggregates for the trainer dashboard. */
  getUsage = async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const overview = await this.service.getUsageOverview();
    this.ok(res, overview);
  };

  deleteHistory = async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    await this.service.deleteAllHistory(req.user.id);
    this.ok(res, null, 'All conversation history has been deleted.');
  };

  deleteConversation = async (req: Request, res: Response) => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    await this.service.deleteConversation(req.params.id as string, req.user);
    this.ok(res, null, 'Conversation deleted.');
  };
}
