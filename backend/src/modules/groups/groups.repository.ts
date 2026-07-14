import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { GroupListFilters, GroupSortField, SortOrder } from './groups.types';

function buildWhere(filters: GroupListFilters): Prisma.GroupWhereInput {
  const where: Prisma.GroupWhereInput = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.experienceLevelId) where.experienceLevelId = filters.experienceLevelId;
  if (filters.trainerId) where.trainerId = filters.trainerId;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {
      ...(filters.startDateFrom ? { gte: new Date(filters.startDateFrom) } : {}),
      ...(filters.startDateTo ? { lte: new Date(filters.startDateTo) } : {}),
    };
  }

  return where;
}

const summaryInclude = {
  department: { select: { id: true, name: true, code: true } },
  experienceLevel: { select: { id: true, name: true, code: true } },
  trainer: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { members: true } },
} satisfies Prisma.GroupInclude;

// Data-access layer for the groups module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class GroupsRepository extends BaseRepository {
  async findMany(
    filters: GroupListFilters,
    skip: number,
    take: number,
    sortBy: GroupSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.group.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder }, include: summaryInclude }),
      this.db.group.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return this.db.group.findFirst({ where: { id, deletedAt: null }, include: summaryInclude });
  }

  findByCode(code: string) {
    return this.db.group.findUnique({ where: { code } });
  }

  findTrainerById(id: string) {
    return this.db.user.findFirst({ where: { id, role: 'TRAINER' } });
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
    return membership !== null;
  }

  create(data: Prisma.GroupCreateInput) {
    return this.db.group.create({ data, include: summaryInclude });
  }

  update(id: string, data: Prisma.GroupUpdateInput) {
    return this.db.group.update({ where: { id }, data, include: summaryInclude });
  }

  softDelete(id: string) {
    return this.db.group.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  countByStatus(status: 'ACTIVE' | 'ARCHIVED') {
    return this.db.group.count({ where: { deletedAt: null, status } });
  }

  countAll() {
    return this.db.group.count({ where: { deletedAt: null } });
  }

  countDepartments() {
    return this.db.department.count();
  }

  countTrainees() {
    return this.db.user.count({ where: { role: 'TRAINEE' } });
  }

  recent(take: number) {
    return this.db.group.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      include: summaryInclude,
    });
  }

  /**
   * The groups `userId` is a member of (Prompt 7 § GROUP VISIBILITY — a trainee needs to know
   * which of their own groups they can post a GROUP-visibility Q&A question to, but `GET /groups`
   * is Trainer/Super-Admin-only for the full org list). Deliberately minimal — id/name/code only,
   * no roster/trainer/counts — since this exists purely to populate a "pick a group" dropdown.
   */
  findMyGroups(userId: string) {
    return this.db.group.findMany({
      where: { status: 'ACTIVE', deletedAt: null, members: { some: { userId } } },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }
}
