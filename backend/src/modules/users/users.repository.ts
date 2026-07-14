import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { UserListFilters, UserSortField, SortOrder } from './users.types';

function buildWhere(filters: UserListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) where.role = filters.role;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.experienceLevelId) where.experienceLevelId = filters.experienceLevelId;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// Data-access layer for the users module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class UsersRepository extends BaseRepository {
  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findMany(
    filters: UserListFilters,
    skip: number,
    take: number,
    sortBy: UserSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.user.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder } }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  setActive(id: string, isActive: boolean) {
    return this.db.user.update({ where: { id }, data: { isActive } });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.db.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date() } });
  }

  revokeAllRefreshTokens(userId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
