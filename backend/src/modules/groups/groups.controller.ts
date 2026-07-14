import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  AssignTrainerDto,
  CreateGroupDto,
  DuplicateGroupDto,
  ListGroupsQueryDto,
  UpdateGroupDto,
  UpdateGroupStatusDto,
} from './groups.dto';
import { GroupsService } from './groups.service';
import type { GroupSortField, SortOrder } from './groups.types';

// HTTP request handlers for the groups module. No business logic here — see groups.service.ts.
export class GroupsController extends BaseController {
  constructor(protected readonly service: GroupsService = new GroupsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as ListGroupsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      {
        status: query.status,
        departmentId: query.departmentId,
        experienceLevelId: query.experienceLevelId,
        trainerId: query.trainerId,
        search: query.search,
        startDateFrom: query.startDateFrom,
        startDateTo: query.startDateTo,
      },
      page,
      pageSize,
      (query.sortBy as GroupSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  stats = async (_req: Request, res: Response): Promise<void> => {
    const [stats, recent] = await Promise.all([this.service.getStats(), this.service.recent(5)]);
    this.ok(res, { ...stats, recentGroups: recent });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const group = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, group);
  };

  /** Any authenticated user's own group memberships (Prompt 7 § GROUP VISIBILITY). */
  mine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const groups = await this.service.listMine(req.user.id);
    this.ok(res, groups);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const group = await this.service.create(req.body as CreateGroupDto, req.user.id, req.ip);
    this.created(res, group, 'Group created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const group = await this.service.update(req.params.id as string, req.body as UpdateGroupDto, req.user.id, req.ip);
    this.ok(res, group, 'Group updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const dto = req.body as UpdateGroupStatusDto;
    const group =
      dto.status === 'ARCHIVED'
        ? await this.service.archive(req.params.id as string, req.user.id, req.ip)
        : await this.service.restore(req.params.id as string, req.user.id, req.ip);
    this.ok(res, group, 'Group status updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.softDelete(req.params.id as string, req.user.id, req.ip);
    this.noContent(res);
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const group = await this.service.duplicate(
      req.params.id as string,
      req.body as DuplicateGroupDto,
      req.user.id,
      req.ip,
    );
    this.created(res, group, 'Group duplicated successfully.');
  };

  assignTrainer = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const group = await this.service.assignTrainer(
      req.params.id as string,
      req.body as AssignTrainerDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, group, 'Trainer assignment updated successfully.');
  };
}
