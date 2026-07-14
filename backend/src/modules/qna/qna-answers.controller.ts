import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateAnswerDto, PinAnswerDto, UpdateAnswerDto, VerifyAnswerDto } from './qna-answers.dto';
import { qnaAnswersService } from './qna-answers.service';

/**
 * HTTP request handlers for the qna-answers module. No business logic here — see
 * qna-answers.service.ts.
 *
 * The orchestrating qna.routes.ts mounts `create`/`update`/`remove`/`pin` under
 * `/api/v1/qna/answers` (where `:id` is the answer id) and mounts `verify` separately under
 * `/api/v1/qna/questions/:id/verify-answer` (where `:id` there is the QUESTION id instead — see
 * `verify`'s own doc-comment). Every handler reads whatever the route named `:id` off
 * `req.params.id`, exactly like resources.controller.ts does for its own re-used `:id` param.
 */
export class QnaAnswersController extends BaseController {
  constructor(protected readonly service = qnaAnswersService) {
    super();
  }

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const answer = await this.service.create(req.body as CreateAnswerDto, req.user, req.ip);
    this.created(res, answer, 'Answer posted successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const answer = await this.service.update(req.params.id as string, req.body as UpdateAnswerDto, req.user, req.ip);
    this.ok(res, answer, 'Answer updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    await this.service.remove(req.params.id as string, req.user, req.ip);
    this.noContent(res);
  };

  pin = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const { isPinned } = req.body as PinAnswerDto;
    const answer = await this.service.pin(req.params.id as string, isPinned, req.user, req.ip);
    this.ok(res, answer, 'Answer pin status updated successfully.');
  };

  /**
   * Mounted by the orchestrator at `POST /api/v1/qna/questions/:id/verify-answer` — `:id` there
   * is the QUESTION id (the target answer id travels in the body as `answerId`), unlike every
   * other handler above where `:id` is the answer id. This controller doesn't need to know
   * which entity `:id` represents on any given route; it just forwards it as `questionId` to
   * the service, which is the only thing this action's service method understands.
   */
  verify = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const answer = await this.service.verify(req.params.id as string, req.body as VerifyAnswerDto, req.user, req.ip);
    this.ok(res, answer, 'Answer verified successfully.');
  };
}
