import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateCommentDto } from './qna-comments.dto';
import { QnaCommentsService } from './qna-comments.service';

// HTTP request handlers for the qna-comments module. No business logic here — see qna-comments.service.ts.
export class QnaCommentsController extends BaseController {
  constructor(protected readonly service: QnaCommentsService = new QnaCommentsService()) {
    super();
  }

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const comment = await this.service.create(req.body as CreateCommentDto, req.user);
    this.created(res, comment, 'Comment posted.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.user);
    this.noContent(res);
  };
}
