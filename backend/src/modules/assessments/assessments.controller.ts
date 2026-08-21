import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  AddAssessmentQuestionDto,
  AssignGroupDto,
  CreateAssessmentDto,
  DuplicateAssessmentDto,
  ListAssessmentsQueryDto,
  ReorderAssessmentQuestionsDto,
  UpdateAssessmentDto,
  UpdateAssessmentQuestionDto,
  UpdateAssessmentStatusDto,
} from './assessments.dto';
import { AssessmentsService } from './assessments.service';
import type { AssessmentSortField, SortOrder } from './assessments.types';

// HTTP request handlers for the assessments module. No business logic here — see assessments.service.ts.
export class AssessmentsController extends BaseController {
  constructor(protected readonly service: AssessmentsService = new AssessmentsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListAssessmentsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      req.user,
      { status: query.status, search: query.search },
      page,
      pageSize,
      (query.sortBy as AssessmentSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  stats = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const stats = await this.service.getStats(req.user);
    this.ok(res, stats);
  };

  mine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const items = await this.service.listMine(req.user.id);
    this.ok(res, items);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, assessment);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.create(req.body as CreateAssessmentDto, req.user, req.ip);
    this.created(res, assessment, 'Assessment created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.update(req.params.id as string, req.body as UpdateAssessmentDto, req.user, req.ip);
    this.ok(res, assessment, 'Assessment updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateAssessmentStatusDto,
      req.user,
      req.ip,
    );
    this.ok(res, assessment, 'Assessment status updated successfully.');
  };

  releaseResults = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.releaseResults(req.params.id as string, req.user, req.ip);
    this.ok(res, assessment, 'Assessment results released successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.softDelete(req.params.id as string, req.user, req.ip);
    this.noContent(res);
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assessment = await this.service.duplicate(
      req.params.id as string,
      req.body as DuplicateAssessmentDto,
      req.user,
      req.ip,
    );
    this.created(res, assessment, 'Assessment duplicated successfully.');
  };

  listAssignments = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const groups = await this.service.listAssignments(req.params.id as string, req.user);
    this.ok(res, groups);
  };

  assignGroup = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assignment = await this.service.assignGroup(req.params.id as string, req.body as AssignGroupDto, req.user, req.ip);
    this.created(res, assignment, 'Group assigned successfully.');
  };

  unassignGroup = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.unassignGroup(req.params.id as string, req.params.groupId as string, req.user, req.ip);
    this.noContent(res);
  };

  listQuestions = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const questions = await this.service.listQuestions(req.params.id as string, req.user);
    this.ok(res, questions);
  };

  addQuestion = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.addQuestion(
      req.params.id as string,
      req.body as AddAssessmentQuestionDto,
      req.user,
      req.ip,
    );
    this.created(res, question, 'Question added successfully.');
  };

  updateQuestion = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const question = await this.service.updateQuestionMarks(
      req.params.id as string,
      req.params.aqId as string,
      req.body as UpdateAssessmentQuestionDto,
      req.user,
      req.ip,
    );
    this.ok(res, question, 'Question updated successfully.');
  };

  removeQuestion = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.removeQuestion(req.params.id as string, req.params.aqId as string, req.user, req.ip);
    this.noContent(res);
  };

  reorderQuestions = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.reorderQuestions(
      req.params.id as string,
      req.body as ReorderAssessmentQuestionsDto,
      req.user,
      req.ip,
    );
    this.noContent(res);
  };
}
