import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { BadRequestError, UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { GradeAnswerDto, ListAttemptsQueryDto, SaveAnswerDto } from './assessment-attempts.dto';
import { AssessmentAttemptsService } from './assessment-attempts.service';

// HTTP request handlers for the assessment-attempts module. No business logic here — see
// assessment-attempts.service.ts.
//
// Nested under the assessments module's router (`/assessments/:id/attempts`,
// `Router({ mergeParams: true })` — see assessment-attempts.routes.ts / README.md), so every
// handler here reads the assessment id off `req.params.id`, exactly like resources.controller.ts
// reads the lesson id off `req.params.id` when nested under lessons.routes.ts.
export class AssessmentAttemptsController extends BaseController {
  constructor(protected readonly service: AssessmentAttemptsService = new AssessmentAttemptsService()) {
    super();
  }

  // ---- Trainee-facing ----

  start = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.start(req.params.id as string, req.user.id);
    this.ok(res, result, 'Attempt started.');
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.getMine(req.params.id as string, req.user.id);
    this.ok(res, result);
  };

  saveAnswer = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.saveAnswer(
      req.params.id as string,
      req.params.assessmentQuestionId as string,
      req.body as SaveAnswerDto,
      req.user.id,
    );
    this.ok(res, result, 'Answer saved.');
  };

  uploadAnswer = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) throw new BadRequestError('A file is required.');
    const result = await this.service.uploadAnswer(
      req.params.id as string,
      req.params.assessmentQuestionId as string,
      req.file,
      req.user.id,
    );
    this.ok(res, result, 'File uploaded.');
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.submit(req.params.id as string, req.user.id, req.ip);
    this.ok(res, result, 'Assessment submitted successfully.');
  };

  // ---- Trainer/Super-Admin-facing ----

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListAttemptsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);
    const result = await this.service.listAttempts(
      req.params.id as string,
      req.user,
      { status: query.status },
      page,
      pageSize,
    );
    this.ok(res, result);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.getAttemptDetail(
      req.params.id as string,
      req.params.attemptId as string,
      req.user,
    );
    this.ok(res, result);
  };

  gradeAnswer = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.gradeAnswer(
      req.params.id as string,
      req.params.attemptId as string,
      req.params.answerId as string,
      req.body as GradeAnswerDto,
      req.user,
      req.ip,
    );
    this.ok(res, result, 'Answer graded.');
  };
}
