import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateDepartmentDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './departments.dto';
import { DepartmentsService } from './departments.service';
import type { DepartmentSortField, SortOrder } from './departments.types';

// HTTP request handlers for the departments module. No business logic here — see departments.service.ts.
export class DepartmentsController extends BaseController {
  constructor(protected readonly service: DepartmentsService = new DepartmentsService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListDepartmentsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      req.user,
      { status: query.status, search: query.search },
      page,
      pageSize,
      (query.sortBy as DepartmentSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const department = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, department);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const department = await this.service.create(req.body as CreateDepartmentDto, req.user.id, req.ip);
    this.created(res, department, 'Department created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const department = await this.service.update(
      req.params.id as string,
      req.body as UpdateDepartmentDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, department, 'Department updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const department = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateDepartmentStatusDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, department, 'Department status updated successfully.');
  };
}
