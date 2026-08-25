import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { ChatRequestDto, CreateTraineeVideoDto, ListConversationsQueryDto } from './ai.dto';
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

  createVideo = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.createTraineeVideo(req.body as CreateTraineeVideoDto, req.user, req.ip);
    this.created(res, result, 'Video generation started.');
  };

  getVideo = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    this.ok(res, await this.service.getTraineeVideo(req.params.jobId as string, req.user));
  };

  previewVideo = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const preview = await this.service.previewTraineeVideo(req.params.jobId as string, req.user);
    res.setHeader('Content-Type', preview.mimeType);
    res.setHeader('Content-Disposition', 'inline; filename="tutor-video.mp4"');
    res.setHeader('Cache-Control', 'private, no-store');
    if (preview.size) res.setHeader('Content-Length', String(preview.size));
    await pipeline(preview.stream, res);
  };

  retryVideo = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    this.ok(res, await this.service.retryTraineeVideo(req.params.jobId as string, req.user));
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
