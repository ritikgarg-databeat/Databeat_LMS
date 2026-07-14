import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateQnaQuestionDto,
  ListQnaQuestionsQueryDto,
  UpdateQnaQuestionDto,
  UpdateQnaQuestionStatusDto,
} from './qna-questions.dto';
import { QnaQuestionsService } from './qna-questions.service';

/**
 * HTTP request handlers for the qna-questions module. No business logic here — see
 * qna-questions.service.ts. Mounted (by the orchestrating session, not this file) under
 * `/api/v1/qna/questions`, with `authenticate` already run so `req.user` is populated.
 */
export class QnaQuestionsController extends BaseController {
  constructor(protected readonly service: QnaQuestionsService = new QnaQuestionsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as ListQnaQuestionsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      {
        status: query.status,
        tag: query.tag,
        search: query.search,
        courseId: query.courseId,
        mine: query.mine === 'true',
        unanswered: query.unanswered === 'true',
        pendingVerification: query.pendingVerification === 'true',
      },
      req.user,
      page,
      pageSize,
      query.sortBy ?? 'newest',
    );
    this.ok(res, result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, question);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.create(req.body as CreateQnaQuestionDto, req.user, req.ip);
    this.created(res, question, 'Question posted successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.update(req.params.id as string, req.body as UpdateQnaQuestionDto, req.user, req.ip);
    this.ok(res, question, 'Question updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.user, req.ip);
    this.noContent(res);
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateQnaQuestionStatusDto,
      req.user,
      req.ip,
    );
    this.ok(res, question, 'Question status updated successfully.');
  };

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) throw new BadRequestError('A file is required.');

    const attachment = await this.service.uploadAttachment(req.params.id as string, req.file, req.user);
    this.created(res, attachment, 'Attachment uploaded successfully.');
  };

  removeAttachment = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.removeAttachment(req.params.id as string, req.params.attachmentId as string, req.user);
    this.noContent(res);
  };

  downloadAttachment = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const { stream, attachment } = await this.service.downloadAttachment(
      req.params.id as string,
      req.params.attachmentId as string,
      req.user,
    );

    const safeFilename = attachment.fileName.replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', attachment.mimeType);

    try {
      // `pipeline` (unlike a bare `stream.pipe(res)`) turns a read-stream error — e.g. the file
      // being missing on disk, since `removeAttachment` deletes it best-effort — into a rejected
      // promise instead of an unhandled 'error' event, which would otherwise crash the process.
      await pipeline(stream, res);
    } catch (error) {
      if (res.headersSent) {
        logger.error('Qna attachment stream failed mid-response', { error, attachmentId: req.params.attachmentId });
        res.destroy();
        return;
      }
      throw new NotFoundError('The requested file could not be found.');
    }
  };
}
