import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { GroupMemberListFilters, GroupMemberSortField, SortOrder } from './group-members.types';

const memberInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      departmentId: true,
      experienceLevelId: true,
      lastLogin: true,
    },
  },
} satisfies Prisma.GroupMemberInclude;

function buildWhere(groupId: string, filters: GroupMemberListFilters): Prisma.GroupMemberWhereInput {
  const where: Prisma.GroupMemberWhereInput = { groupId };
  if (filters.search) {
    where.user = {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
  }
  return where;
}

// Data-access layer for the group-members module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class GroupMembersRepository extends BaseRepository {
  async findMany(
    groupId: string,
    filters: GroupMemberListFilters,
    skip: number,
    take: number,
    sortBy: GroupMemberSortField = 'joinedAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(groupId, filters);
    const orderBy: Prisma.GroupMemberOrderByWithRelationInput =
      sortBy === 'name' ? { user: { firstName: sortOrder } } : { joinedAt: sortOrder };

    const [items, total] = await Promise.all([
      this.db.groupMember.findMany({ where, skip, take, orderBy, include: memberInclude }),
      this.db.groupMember.count({ where }),
    ]);
    return { items, total };
  }

  count(groupId: string) {
    return this.db.groupMember.count({ where: { groupId } });
  }

  findOne(groupId: string, userId: string) {
    return this.db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
  }

  add(groupId: string, userId: string, addedById: string) {
    return this.db.groupMember.create({ data: { groupId, userId, addedById }, include: memberInclude });
  }

  remove(groupId: string, userId: string) {
    return this.db.groupMember.delete({ where: { userId_groupId: { userId, groupId } } });
  }

  addMany(groupId: string, userIds: string[], addedById: string) {
    return this.db.groupMember.createMany({
      data: userIds.map((userId) => ({ groupId, userId, addedById })),
      skipDuplicates: true,
    });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }
}
