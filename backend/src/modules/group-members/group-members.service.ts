import type { Role } from '@prisma/client';
import { parse } from 'csv-parse/sync';

import { MAX_MEMBER_IMPORT_ROWS } from '@/constants/groups';
import { GroupsRepository } from '@/modules/groups/groups.repository';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { AddGroupMemberDto, AddGroupMembersDto, TransferGroupMemberDto } from './group-members.dto';
import { GroupMembersRepository } from './group-members.repository';
import type {
  BulkImportSummary,
  GroupMemberListFilters,
  GroupMemberSortField,
  SortOrder,
} from './group-members.types';

interface CapacityCheckable {
  id: string;
  capacity: number | null;
}

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the group-members module. Controllers call into this layer only.
export class GroupMembersService extends BaseService {
  constructor(
    protected readonly repository: GroupMembersRepository = new GroupMembersRepository(),
    private readonly groupsRepository: GroupsRepository = new GroupsRepository(),
  ) {
    super();
  }

  async list(
    groupId: string,
    actor: Actor,
    filters: GroupMemberListFilters,
    page: number,
    pageSize: number,
    sortBy: GroupMemberSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    await this.findGroupOrThrow(groupId);

    if (actor.role === 'TRAINEE') {
      const isMember = await this.groupsRepository.isMember(groupId, actor.id);
      if (!isMember) throw new ForbiddenError("You don't have permission to view this group's members.");
    }

    const { items, total } = await this.repository.findMany(
      groupId,
      filters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
    );
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async add(groupId: string, dto: AddGroupMemberDto, actorId: string, ipAddress?: string | null) {
    const startedAt = Date.now();
    const group = await this.findGroupOrThrow(groupId);
    const user = await this.assertTraineeExists(dto.userId);

    const existing = await this.repository.findOne(groupId, dto.userId);
    if (existing) throw new ConflictError('This user is already a member of the group.');

    await this.assertCapacityAvailable(group, 1);

    const member = await this.repository.add(groupId, dto.userId, actorId);

    await auditLogService.record({
      action: 'GROUP_MEMBER_ADDED',
      actorId,
      targetUserId: user.id,
      ipAddress,
      metadata: { groupId, durationMs: Date.now() - startedAt },
    });

    return member;
  }

  async addMany(groupId: string, dto: AddGroupMembersDto, actorId: string, ipAddress?: string | null) {
    const group = await this.findGroupOrThrow(groupId);
    const uniqueIds = Array.from(new Set(dto.userIds));

    const validated: string[] = [];
    for (const userId of uniqueIds) {
      const user = await this.repository.findUserById(userId);
      const existing = await this.repository.findOne(groupId, userId);
      if (user && user.role === 'TRAINEE' && !existing) validated.push(userId);
    }

    await this.assertCapacityAvailable(group, validated.length);

    if (validated.length) {
      await this.repository.addMany(groupId, validated, actorId);
      await auditLogService.record({
        action: 'GROUP_MEMBER_ADDED',
        actorId,
        ipAddress,
        metadata: { groupId, userIds: validated },
      });
    }

    return { added: validated.length, skipped: uniqueIds.length - validated.length };
  }

  async remove(groupId: string, userId: string, actorId: string, ipAddress?: string | null): Promise<void> {
    await this.findGroupOrThrow(groupId);
    const existing = await this.repository.findOne(groupId, userId);
    if (!existing) throw new NotFoundError('This user is not a member of the group.');

    await this.repository.remove(groupId, userId);

    await auditLogService.record({
      action: 'GROUP_MEMBER_REMOVED',
      actorId,
      targetUserId: userId,
      ipAddress,
      metadata: { groupId },
    });
  }

  async transfer(
    groupId: string,
    userId: string,
    dto: TransferGroupMemberDto,
    actorId: string,
    ipAddress?: string | null,
  ) {
    if (dto.toGroupId === groupId) throw new BadRequestError('Source and destination group are the same.');

    await this.findGroupOrThrow(groupId);
    const targetGroup = await this.findGroupOrThrow(dto.toGroupId);

    const membership = await this.repository.findOne(groupId, userId);
    if (!membership) throw new NotFoundError('This user is not a member of the source group.');

    const alreadyInTarget = await this.repository.findOne(dto.toGroupId, userId);
    if (alreadyInTarget) throw new ConflictError('This user is already a member of the destination group.');

    await this.assertCapacityAvailable(targetGroup, 1);

    await this.repository.remove(groupId, userId);
    const member = await this.repository.add(dto.toGroupId, userId, actorId);

    await auditLogService.record({
      action: 'GROUP_MEMBER_TRANSFERRED',
      actorId,
      targetUserId: userId,
      ipAddress,
      metadata: { fromGroupId: groupId, toGroupId: dto.toGroupId },
    });

    return member;
  }

  async bulkImport(
    groupId: string,
    buffer: Buffer,
    actorId: string,
    ipAddress?: string | null,
  ): Promise<BulkImportSummary> {
    const startedAt = Date.now();
    const group = await this.findGroupOrThrow(groupId);

    let rows: Record<string, string>[];
    try {
      rows = parse(buffer, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestError('Could not parse the CSV file. Ensure it has a header row with an "email" column.');
    }

    if (rows.length > MAX_MEMBER_IMPORT_ROWS) {
      throw new BadRequestError(`CSV cannot contain more than ${MAX_MEMBER_IMPORT_ROWS} rows.`);
    }

    const errors: BulkImportSummary['errors'] = [];
    const toAdd: string[] = [];
    const seenInFile = new Set<string>();
    const existingCount = await this.repository.count(groupId);
    const capacityRemaining = group.capacity != null ? Math.max(0, group.capacity - existingCount) : Infinity;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
      const email = row.email?.trim().toLowerCase();

      if (!email) {
        errors.push({ row: rowNumber, email: row.email ?? '', reason: 'Missing email.' });
        continue;
      }
      if (seenInFile.has(email)) {
        errors.push({ row: rowNumber, email, reason: 'Duplicate email within file.' });
        continue;
      }
      seenInFile.add(email);

      const user = await this.repository.findUserByEmail(email);
      if (!user) {
        errors.push({ row: rowNumber, email, reason: 'No account found with this email.' });
        continue;
      }
      if (user.role !== 'TRAINEE') {
        errors.push({ row: rowNumber, email, reason: 'This account is not a trainee.' });
        continue;
      }

      const existingMembership = await this.repository.findOne(groupId, user.id);
      if (existingMembership) {
        errors.push({ row: rowNumber, email, reason: 'Already a member of this group.' });
        continue;
      }

      if (toAdd.length >= capacityRemaining) {
        errors.push({ row: rowNumber, email, reason: 'Group capacity exceeded.' });
        continue;
      }

      toAdd.push(user.id);
    }

    if (toAdd.length) {
      await this.repository.addMany(groupId, toAdd, actorId);
    }

    await auditLogService.record({
      action: 'GROUP_BULK_IMPORT',
      actorId,
      ipAddress,
      metadata: {
        groupId,
        totalRows: rows.length,
        added: toAdd.length,
        errorCount: errors.length,
        durationMs: Date.now() - startedAt,
      },
    });

    return { totalRows: rows.length, added: toAdd.length, skipped: errors.length, errors };
  }

  private async findGroupOrThrow(groupId: string) {
    const group = await this.groupsRepository.findById(groupId);
    if (!group) throw new NotFoundError('Group not found.');
    return group;
  }

  private async assertTraineeExists(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found.');
    if (user.role !== 'TRAINEE') throw new BadRequestError('Only trainees can be added to a group.');
    return user;
  }

  private async assertCapacityAvailable(group: CapacityCheckable, additionalCount: number): Promise<void> {
    if (group.capacity == null || additionalCount === 0) return;
    const currentCount = await this.repository.count(group.id);
    if (currentCount + additionalCount > group.capacity) {
      throw new ConflictError('Group is at or would exceed full capacity.');
    }
  }
}
