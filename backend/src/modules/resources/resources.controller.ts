import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateTextResourceDto, UploadResourceDto } from './resources.dto';
import { ResourcesService } from './resources.service';

// HTTP request handlers for the resources module. No business logic here — see resources.service.ts.
//
// Nested under the lessons module's router (`/lessons/:id/resources`, `Router({ mergeParams: true })`
// — see resources.routes.ts / README.md), so every handler here reads the lesson id off
// `req.params.id`, exactly like lessons.routes.ts's own `:id`.
export class ResourcesController extends BaseController {
  constructor(protected readonly service: ResourcesService = new ResourcesService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const resources = await this.service.list(req.params.id as string, req.user);
    this.ok(res, resources);
  };

  uploadResource = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) throw new BadRequestError('A file is required.');

    const resource = await this.service.uploadResource(
      req.params.id as string,
      req.body as UploadResourceDto,
      req.file,
      req.user,
      req.ip,
    );
    this.created(res, resource, 'Resource uploaded successfully.');
  };

  createTextResource = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const resource = await this.service.createTextResource(
      req.params.id as string,
      req.body as CreateTextResourceDto,
      req.user,
      req.ip,
    );
    this.created(res, resource, 'Resource created successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.params.resourceId as string, req.user, req.ip);
    this.noContent(res);
  };

  download = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const { stream, resource } = await this.service.download(
      req.params.id as string,
      req.params.resourceId as string,
      req.user,
    );

    const safeFilename = (resource.originalFilename ?? 'download').replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', resource.mimeType ?? 'application/octet-stream');

    try {
      // `pipeline` (unlike a bare `stream.pipe(res)`) turns a read-stream error — e.g. the file
      // being missing on disk, since `remove()` deletes it best-effort — into a rejected promise
      // instead of an unhandled 'error' event, which would otherwise crash the whole process.
      await pipeline(stream, res);
    } catch (error) {
      if (res.headersSent) {
        logger.error('Lesson resource stream failed mid-response', { error, resourceId: req.params.resourceId });
        res.destroy();
        return;
      }
      throw new NotFoundError('The requested file could not be found.');
    }
  };
}
