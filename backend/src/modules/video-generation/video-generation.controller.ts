import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateVideoGenerationDto,
  RegenerateVideoDto,
  UpdateVideoStoryboardDto,
} from './video-generation.dto';
import { videoGenerationService, type VideoGenerationService } from './video-generation.service';

export class VideoGenerationController extends BaseController {
  constructor(private readonly service: VideoGenerationService = videoGenerationService) {
    super();
  }

  sources = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(res, await this.service.sources(req.params.id as string, actor));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(res, await this.service.list(req.params.id as string, actor));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(res, await this.service.get(req.params.id as string, req.params.jobId as string, actor));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    const job = await this.service.create(
      req.params.id as string,
      req.body as CreateVideoGenerationDto,
      actor,
      req.ip,
    );
    this.created(res, job, 'Video storyboard generation started.');
  };

  updateStoryboard = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(
      res,
      await this.service.updateStoryboard(
        req.params.id as string,
        req.params.jobId as string,
        req.body as UpdateVideoStoryboardDto,
        actor,
      ),
      'Storyboard saved.',
    );
  };

  regenerate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(
      res,
      await this.service.regenerate(
        req.params.id as string,
        req.params.jobId as string,
        req.body as RegenerateVideoDto,
        actor,
      ),
      'Storyboard regeneration queued.',
    );
  };

  render = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(
      res,
      await this.service.render(req.params.id as string, req.params.jobId as string, actor),
      'Video rendering queued.',
    );
  };

  preview = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    const preview = await this.service.preview(req.params.id as string, req.params.jobId as string, actor);
    res.setHeader('Content-Type', preview.mimeType);
    res.setHeader('Content-Disposition', 'inline; filename="lesson-video-preview.mp4"');
    res.setHeader('Cache-Control', 'private, no-store');
    if (preview.size) res.setHeader('Content-Length', String(preview.size));
    await pipeline(preview.stream, res);
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    this.ok(
      res,
      await this.service.publish(req.params.id as string, req.params.jobId as string, actor, req.ip),
      'Video published. Completed trainees must review the lesson and retake its quiz.',
    );
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const actor = this.actor(req);
    await this.service.cancel(req.params.id as string, req.params.jobId as string, actor, req.ip);
    this.noContent(res);
  };

  private actor(req: Request) {
    if (!req.user) throw new UnauthorizedError();
    return req.user;
  }
}
