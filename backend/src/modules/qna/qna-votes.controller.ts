import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { ToggleVoteDto } from './qna-votes.dto';
import { QnaVotesService } from './qna-votes.service';

// HTTP request handlers for the qna-votes module. No business logic here — see qna-votes.service.ts.
export class QnaVotesController extends BaseController {
  constructor(protected readonly service: QnaVotesService = new QnaVotesService()) {
    super();
  }

  toggle = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.toggle(req.body as ToggleVoteDto, req.user);
    this.ok(res, result);
  };
}
