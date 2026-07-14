import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { ListTagsQueryDto } from './qna-tags.dto';
import { QnaTagsService } from './qna-tags.service';

// HTTP request handlers for the qna-tags module. No business logic here — see qna-tags.service.ts.
export class QnaTagsController extends BaseController {
  constructor(protected readonly service: QnaTagsService = new QnaTagsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as ListTagsQueryDto;
    const tags = await this.service.list({ search: query.search });
    this.ok(res, tags);
  };
}
