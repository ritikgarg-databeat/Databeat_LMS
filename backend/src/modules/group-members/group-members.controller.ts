import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { BadRequestError, UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertUploadMatchesDeclaredType } from '@/utils/upload-safety.util';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  AddGroupMemberDto,
  AddGroupMembersDto,
  ListGroupMembersQueryDto,
  TransferGroupMemberDto,
} from './group-members.dto';
import { GroupMembersService } from './group-members.service';
import type { GroupMemberSortField, SortOrder } from './group-members.types';

// HTTP request handlers for the group-members module. No business logic here — see group-members.service.ts.
export class GroupMembersController extends BaseController {
  constructor(protected readonly service: GroupMembersService = new GroupMembersService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListGroupMembersQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(
      req.params.groupId as string,
      req.user,
      { search: query.search },
      page,
      pageSize,
      (query.sortBy as GroupMemberSortField) ?? 'joinedAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };

  add = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const member = await this.service.add(
      req.params.groupId as string,
      req.body as AddGroupMemberDto,
      req.user,
      req.ip,
    );
    this.created(res, member, 'Member added successfully.');
  };

  addMany = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.addMany(
      req.params.groupId as string,
      req.body as AddGroupMembersDto,
      req.user,
      req.ip,
    );
    this.created(res, result, 'Members added successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.groupId as string, req.params.userId as string, req.user, req.ip);
    this.noContent(res);
  };

  transfer = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const member = await this.service.transfer(
      req.params.groupId as string,
      req.params.userId as string,
      req.body as TransferGroupMemberDto,
      req.user,
      req.ip,
    );
    this.ok(res, member, 'Member transferred successfully.');
  };

  bulkImport = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) throw new BadRequestError('A CSV file is required.');
    await assertUploadMatchesDeclaredType(req.file);
    const summary = await this.service.bulkImport(
      req.params.groupId as string,
      req.file.buffer,
      req.user,
      req.ip,
    );
    this.ok(res, summary, 'Bulk import complete.');
  };
}
