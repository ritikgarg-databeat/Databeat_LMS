import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  ChangeRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
} from './users.dto';
import { UsersService } from './users.service';
import type { SortOrder, UserSortField } from './users.types';

// HTTP request handlers for the users module. No business logic here — see users.service.ts.
export class UsersController extends BaseController {
  constructor(protected readonly service: UsersService = new UsersService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as ListUsersQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    // Pagination meta is nested inside `data` (not a new top-level envelope field) to stay
    // within the exact { success, message, data } response format established in Prompt 2.
    const result = await this.service.list(
      req.user,
      {
        role: query.role,
        departmentId: query.departmentId,
        experienceLevelId: query.experienceLevelId,
        isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
        search: query.search,
      },
      page,
      pageSize,
      (query.sortBy as UserSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.getById(req.user, req.params.id as string);
    this.ok(res, user);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.create(req.user, req.body as CreateUserDto, req.ip);
    this.created(res, user, 'User created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.update(
      req.user,
      req.params.id as string,
      req.body as UpdateUserDto,
      req.ip,
    );
    this.ok(res, user, 'User updated successfully.');
  };

  updateOwnProfile = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.updateOwnProfile(req.user.id, req.body as UpdateOwnProfileDto);
    this.ok(res, user, 'Profile updated successfully.');
  };

  deactivate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.deactivate(req.user, req.params.id as string, req.ip);
    this.ok(res, user, 'User deactivated successfully.');
  };

  reactivate = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.reactivate(req.user, req.params.id as string, req.ip);
    this.ok(res, user, 'User reactivated successfully.');
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    // Body is entirely optional here (auto-generate vs. caller-supplied password) — a
    // request sent with no body/Content-Type leaves req.body undefined, not {}.
    const result = await this.service.resetPassword(
      req.user,
      req.params.id as string,
      (req.body ?? {}) as ResetPasswordDto,
      req.ip,
    );
    this.ok(res, result, 'Password reset successfully.');
  };

  changeRole = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const user = await this.service.changeRole(
      req.user,
      req.params.id as string,
      req.body as ChangeRoleDto,
      req.ip,
    );
    this.ok(res, user, 'Role updated successfully.');
  };
}
