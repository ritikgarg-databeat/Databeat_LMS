import type { Role } from '@prisma/client';

import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { ConflictError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { CreateDepartmentDto, UpdateDepartmentDto, UpdateDepartmentStatusDto } from './departments.dto';
import { DepartmentsRepository } from './departments.repository';
import type { DepartmentListFilters, DepartmentSortField, SortOrder } from './departments.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the departments module. Controllers call into this layer only.
export class DepartmentsService extends BaseService {
  constructor(protected readonly repository: DepartmentsRepository = new DepartmentsRepository()) {
    super();
  }

  async list(
    actor: Actor,
    filters: DepartmentListFilters,
    page: number,
    pageSize: number,
    sortBy: DepartmentSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(
      filters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
      actor.role === 'TRAINER' ? actor.id : undefined,
    );
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getById(id: string, actor?: Actor) {
    const department =
      actor?.role === 'TRAINER'
        ? await this.repository.findByIdInTrainerScope(id, actor.id)
        : await this.repository.findById(id);
    if (!department) throw new NotFoundError('Department not found.');
    return department;
  }

  async create(dto: CreateDepartmentDto, actorId: string, ipAddress?: string | null) {
    await this.assertNameAndCodeAvailable(dto.name, dto.code);

    const created = await this.repository.create({
      name: dto.name,
      code: dto.code,
      description: dto.description,
      createdBy: { connect: { id: actorId } },
    });

    await auditLogService.record({
      action: 'DEPARTMENT_CREATED',
      actorId,
      ipAddress,
      metadata: { departmentId: created.id, name: created.name },
    });

    return created;
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId: string, ipAddress?: string | null) {
    const existing = await this.getById(id);
    await this.assertNameAndCodeAvailable(dto.name, dto.code, id);

    const updated = await this.repository.update(id, {
      name: dto.name,
      code: dto.code,
      description: dto.description,
    });

    await auditLogService.record({
      action: 'DEPARTMENT_UPDATED',
      actorId,
      ipAddress,
      metadata: { departmentId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateDepartmentStatusDto, actorId: string, ipAddress?: string | null) {
    const existing = await this.getById(id);

    const updated = await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'DEPARTMENT_STATUS_CHANGED',
      actorId,
      ipAddress,
      metadata: { departmentId: existing.id, from: existing.status, to: dto.status },
    });

    return updated;
  }

  private async assertNameAndCodeAvailable(name?: string, code?: string, excludeId?: string): Promise<void> {
    if (name) {
      const existing = await this.repository.findByName(name);
      if (existing && existing.id !== excludeId) {
        throw new ConflictError('A department with this name already exists.');
      }
    }
    if (code) {
      const existing = await this.repository.findByCode(code);
      if (existing && existing.id !== excludeId) {
        throw new ConflictError('A department with this code already exists.');
      }
    }
  }
}
