import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { SearchQueryDto } from './qna-search.dto';
import { QnaSearchService } from './qna-search.service';
import { DEFAULT_SEARCH_LIMIT_PER_CATEGORY, MAX_SEARCH_LIMIT_PER_CATEGORY } from './qna-search.types';

// HTTP request handlers for the qna-search module. No business logic here — see qna-search.service.ts.
export class QnaSearchController extends BaseController {
  constructor(protected readonly service: QnaSearchService = new QnaSearchService()) {
    super();
  }

  search = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as SearchQueryDto;
    const limit = Math.min(
      MAX_SEARCH_LIMIT_PER_CATEGORY,
      Math.max(1, Number(query.limit) || DEFAULT_SEARCH_LIMIT_PER_CATEGORY),
    );

    const result = await this.service.search((query.q as string).trim(), limit, req.user);
    this.ok(res, result);
  };
}
