import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

// Data-access layer for the experience-levels module. Only this class may query Prisma
// directly (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class ExperienceLevelsRepository extends BaseRepository {
  findAllActive() {
    return this.db.experienceLevel.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  findAll() {
    return this.db.experienceLevel.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.db.experienceLevel.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.db.experienceLevel.findUnique({ where: { name } });
  }

  findByCode(code: string) {
    return this.db.experienceLevel.findUnique({ where: { code } });
  }

  create(data: Prisma.ExperienceLevelCreateInput) {
    return this.db.experienceLevel.create({ data });
  }

  update(id: string, data: Prisma.ExperienceLevelUpdateInput) {
    return this.db.experienceLevel.update({ where: { id }, data });
  }
}
