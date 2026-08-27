import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  AssignGroupDto,
  CreateCourseDto,
  DuplicateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
  UpdateCourseAssignmentDto,
} from './courses.dto';
import { CoursesService } from './courses.service';
import type { CourseSortField, SortOrder } from './courses.types';

// HTTP request handlers for the courses module. No business logic here — see courses.service.ts.
export class CoursesController extends BaseController {
  constructor(protected readonly service: CoursesService = new CoursesService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListCoursesQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      req.user,
      {
        status: query.status,
        difficulty: query.difficulty,
        departmentId: query.departmentId,
        experienceLevelId: query.experienceLevelId,
        search: query.search,
      },
      page,
      pageSize,
      (query.sortBy as CourseSortField) ?? 'createdAt',
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
    const course = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, course);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const course = await this.service.create(req.body as CreateCourseDto, req.user, req.ip);
    this.created(res, course, 'Course created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const course = await this.service.update(
      req.params.id as string,
      req.body as UpdateCourseDto,
      req.user,
      req.ip,
    );
    this.ok(res, course, 'Course updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const course = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateCourseStatusDto,
      req.user,
      req.ip,
    );
    this.ok(res, course, 'Course status updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.user, req.ip);
    this.noContent(res);
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const course = await this.service.duplicate(
      req.params.id as string,
      req.body as DuplicateCourseDto,
      req.user,
      req.ip,
    );
    this.created(res, course, 'Course duplicated successfully.');
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
    const assignment = await this.service.assignGroup(
      req.params.id as string,
      req.body as AssignGroupDto,
      req.user,
      req.ip,
    );
    this.created(res, assignment, 'Group assigned successfully.');
  };

  updateAssignment = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const assignment = await this.service.updateAssignment(
      req.params.id as string,
      req.params.groupId as string,
      req.body as UpdateCourseAssignmentDto,
      req.user,
      req.ip,
    );
    this.ok(res, assignment, 'Course requirement updated successfully.');
  };

  unassignGroup = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.unassignGroup(req.params.id as string, req.params.groupId as string, req.user, req.ip);
    this.noContent(res);
  };
}
