import type { Group, Role } from '@prisma/client';

import { DepartmentsRepository } from '@/modules/departments/departments.repository';
import { ExperienceLevelsRepository } from '@/modules/experience-levels/experience-levels.repository';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { AssignTrainerDto, CreateGroupDto, DuplicateGroupDto, UpdateGroupDto } from './groups.dto';
import { GroupsRepository } from './groups.repository';
import type { GroupListFilters, GroupSortField, GroupStats, SortOrder } from './groups.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the groups module. Controllers call into this layer only.
export class GroupsService extends BaseService {
  constructor(
    protected readonly repository: GroupsRepository = new GroupsRepository(),
    private readonly departmentsRepository: DepartmentsRepository = new DepartmentsRepository(),
    private readonly experienceLevelsRepository: ExperienceLevelsRepository = new ExperienceLevelsRepository(),
  ) {
    super();
  }

  async list(
    filters: GroupListFilters,
    page: number,
    pageSize: number,
    sortBy: GroupSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(filters, (page - 1) * pageSize, pageSize, sortBy, sortOrder);
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getById(id: string, actor: Actor) {
    const group = await this.findOrThrow(id);

    if (actor.role === 'TRAINEE') {
      const isMember = await this.repository.isMember(id, actor.id);
      if (!isMember) throw new ForbiddenError("You don't have permission to view this group.");
    }

    return group;
  }

  async getStats(): Promise<GroupStats> {
    const [activeGroups, archivedGroups, totalGroups, totalDepartments, totalTrainees] = await Promise.all([
      this.repository.countByStatus('ACTIVE'),
      this.repository.countByStatus('ARCHIVED'),
      this.repository.countAll(),
      this.repository.countDepartments(),
      this.repository.countTrainees(),
    ]);
    return { totalGroups, activeGroups, archivedGroups, totalDepartments, totalTrainees };
  }

  async recent(take: number) {
    return this.repository.recent(take);
  }

  /** Any authenticated user's own group memberships — see `GroupsRepository#findMyGroups`. */
  async listMine(userId: string) {
    return this.repository.findMyGroups(userId);
  }

  async create(dto: CreateGroupDto, actorId: string, ipAddress?: string | null): Promise<Group> {
    await this.assertCodeAvailable(dto.code);
    await this.assertDepartmentExists(dto.departmentId);
    if (dto.experienceLevelId) await this.assertExperienceLevelExists(dto.experienceLevelId);
    if (dto.trainerId) await this.assertTrainerExists(dto.trainerId);
    this.assertDateRangeValid(dto.startDate, dto.endDate);

    const created = await this.repository.create({
      name: dto.name,
      code: dto.code,
      department: { connect: { id: dto.departmentId } },
      ...(dto.experienceLevelId ? { experienceLevel: { connect: { id: dto.experienceLevelId } } } : {}),
      ...(dto.trainerId ? { trainer: { connect: { id: dto.trainerId } } } : {}),
      description: dto.description,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      capacity: dto.capacity,
      createdBy: { connect: { id: actorId } },
    });

    await auditLogService.record({
      action: 'GROUP_CREATED',
      actorId,
      ipAddress,
      metadata: { groupId: created.id, name: created.name, code: created.code },
    });

    return created;
  }

  async update(id: string, dto: UpdateGroupDto, actorId: string, ipAddress?: string | null): Promise<Group> {
    const existing = await this.findOrThrow(id);
    if (dto.code) await this.assertCodeAvailable(dto.code, id);
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.experienceLevelId) await this.assertExperienceLevelExists(dto.experienceLevelId);
    this.assertDateRangeValid(
      dto.startDate === undefined ? existing.startDate?.toISOString() : (dto.startDate ?? undefined),
      dto.endDate === undefined ? existing.endDate?.toISOString() : (dto.endDate ?? undefined),
    );

    const updated = await this.repository.update(id, {
      name: dto.name,
      code: dto.code,
      ...(dto.departmentId ? { department: { connect: { id: dto.departmentId } } } : {}),
      ...(dto.experienceLevelId !== undefined
        ? {
            experienceLevel: dto.experienceLevelId
              ? { connect: { id: dto.experienceLevelId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate ? new Date(dto.startDate) : null } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
    });

    await auditLogService.record({
      action: 'GROUP_UPDATED',
      actorId,
      ipAddress,
      metadata: { groupId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async archive(id: string, actorId: string, ipAddress?: string | null): Promise<Group> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'ARCHIVED') {
      throw new ConflictError('Group is already archived.');
    }

    const updated = await this.repository.update(id, { status: 'ARCHIVED' });

    await auditLogService.record({
      action: 'GROUP_ARCHIVED',
      actorId,
      ipAddress,
      metadata: { groupId: existing.id },
    });

    return updated;
  }

  async restore(id: string, actorId: string, ipAddress?: string | null): Promise<Group> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'ACTIVE') {
      throw new ConflictError('Group is already active.');
    }

    const updated = await this.repository.update(id, { status: 'ACTIVE' });

    await auditLogService.record({
      action: 'GROUP_RESTORED',
      actorId,
      ipAddress,
      metadata: { groupId: existing.id },
    });

    return updated;
  }

  async softDelete(id: string, actorId: string, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'GROUP_DELETED',
      actorId,
      ipAddress,
      metadata: { groupId: existing.id, name: existing.name, code: existing.code },
    });
  }

  async duplicate(id: string, dto: DuplicateGroupDto, actorId: string, ipAddress?: string | null): Promise<Group> {
    const source = await this.findOrThrow(id);
    await this.assertCodeAvailable(dto.code);

    const created = await this.repository.create({
      name: dto.name,
      code: dto.code,
      department: { connect: { id: source.departmentId } },
      ...(source.experienceLevelId ? { experienceLevel: { connect: { id: source.experienceLevelId } } } : {}),
      ...(source.trainerId ? { trainer: { connect: { id: source.trainerId } } } : {}),
      description: source.description,
      capacity: source.capacity,
      createdBy: { connect: { id: actorId } },
    });

    await auditLogService.record({
      action: 'GROUP_CREATED',
      actorId,
      ipAddress,
      metadata: { groupId: created.id, name: created.name, code: created.code, duplicatedFromId: source.id },
    });

    return created;
  }

  async assignTrainer(id: string, dto: AssignTrainerDto, actorId: string, ipAddress?: string | null): Promise<Group> {
    const existing = await this.findOrThrow(id);
    if (dto.trainerId) await this.assertTrainerExists(dto.trainerId);

    const updated = await this.repository.update(id, {
      trainer: dto.trainerId ? { connect: { id: dto.trainerId } } : { disconnect: true },
    });

    await auditLogService.record({
      action: 'GROUP_TRAINER_ASSIGNED',
      actorId,
      ipAddress,
      metadata: { groupId: existing.id, fromTrainerId: existing.trainerId, toTrainerId: dto.trainerId },
    });

    return updated;
  }

  private async findOrThrow(id: string) {
    const group = await this.repository.findById(id);
    if (!group) throw new NotFoundError('Group not found.');
    return group;
  }

  private async assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
    const existing = await this.repository.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError('A group with this code already exists.');
    }
  }

  private async assertDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.departmentsRepository.findById(departmentId);
    if (!department) throw new BadRequestError('Department not found.');
  }

  private async assertExperienceLevelExists(experienceLevelId: string): Promise<void> {
    const level = await this.experienceLevelsRepository.findById(experienceLevelId);
    if (!level) throw new BadRequestError('Experience level not found.');
  }

  private async assertTrainerExists(trainerId: string): Promise<void> {
    const trainer = await this.repository.findTrainerById(trainerId);
    if (!trainer) throw new BadRequestError('Trainer not found.');
  }

  private assertDateRangeValid(startDate?: string, endDate?: string): void {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestError('startDate must be before endDate.');
    }
  }
}
