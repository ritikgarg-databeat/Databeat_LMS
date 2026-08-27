import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { DepartmentListFilters, DepartmentSortField, SortOrder } from './departments.types';

function buildWhere(filters: DepartmentListFilters): Prisma.DepartmentWhereInput {
  const where: Prisma.DepartmentWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// Data-access layer for the departments module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class DepartmentsRepository extends BaseRepository {
  async findMany(
    filters: DepartmentListFilters,
    skip: number,
    take: number,
    sortBy: DepartmentSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
    trainerId?: string,
  ) {
    const where = buildWhere(filters);
    if (trainerId) {
      where.AND = [
        {
          OR: [{ users: { some: { id: trainerId } } }, { groups: { some: { trainerId, deletedAt: null } } }],
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.db.department.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: { _count: { select: { users: true, groups: true } } },
      }),
      this.db.department.count({ where }),
    ]);
    return { items, total };
  }

  findByIdInTrainerScope(id: string, trainerId: string) {
    return this.db.department.findFirst({
      where: {
        id,
        OR: [{ users: { some: { id: trainerId } } }, { groups: { some: { trainerId, deletedAt: null } } }],
      },
      include: { _count: { select: { users: true, groups: true } } },
    });
  }

  findById(id: string) {
    return this.db.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true, groups: true } } },
    });
  }

  findByName(name: string) {
    return this.db.department.findUnique({ where: { name } });
  }

  findByCode(code: string) {
    return this.db.department.findUnique({ where: { code } });
  }

  create(data: Prisma.DepartmentCreateInput) {
    return this.db.department.create({ data });
  }

  update(id: string, data: Prisma.DepartmentUpdateInput) {
    return this.db.department.update({ where: { id }, data });
  }
}
