import type { Prisma } from '@prisma/client';

import { trainerCourseScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { ReorderItem } from './modules.types';

const lessonCountInclude = {
  _count: { select: { lessons: true } },
} satisfies Prisma.CourseModuleInclude;

// Data-access layer for the modules module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class ModulesRepository extends BaseRepository {
  findByCourseId(courseId: string) {
    return this.db.courseModule.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: lessonCountInclude,
    });
  }

  findById(id: string) {
    return this.db.courseModule.findUnique({ where: { id } });
  }

  /** File pointers must be captured before the module delete cascades lessons and resources. */
  findFileResourcesByModuleId(moduleId: string) {
    return this.db.lessonResource.findMany({
      where: { relativePath: { not: null }, lesson: { moduleId } },
      select: { id: true, relativePath: true },
    });
  }

  findByIdWithLessons(id: string) {
    return this.db.courseModule.findUnique({
      where: { id },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
  }

  findManyByIds(courseId: string, ids: string[]) {
    return this.db.courseModule.findMany({ where: { courseId, id: { in: ids } }, select: { id: true } });
  }

  /** Used to confirm a reorder submits EVERY sibling module, not a partial subset (would otherwise leave stale/duplicate `order` values on the untouched rest). */
  countByCourseId(courseId: string) {
    return this.db.courseModule.count({ where: { courseId } });
  }

  /** Feature-local existence check — the courses module owns Course but isn't a dependency here. */
  findCourseById(courseId: string) {
    return this.db.course.findFirst({ where: { id: courseId, deletedAt: null } });
  }

  async isCourseInTrainerScope(courseId: string, trainerId: string): Promise<boolean> {
    const course = await this.db.course.findFirst({
      where: { id: courseId, deletedAt: null, ...trainerCourseScope(trainerId) },
      select: { id: true },
    });
    return course !== null;
  }

  async findNextOrder(courseId: string): Promise<number> {
    const top = await this.db.courseModule.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return top ? top.order + 1 : 0;
  }

  create(data: Prisma.CourseModuleCreateInput) {
    return this.db.courseModule.create({ data });
  }

  update(id: string, data: Prisma.CourseModuleUpdateInput) {
    return this.db.courseModule.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.db.courseModule.delete({ where: { id } });
  }

  reorder(updates: ReorderItem[]) {
    return this.db.$transaction(
      updates.map(({ id, order }) => this.db.courseModule.update({ where: { id }, data: { order } })),
    );
  }
}
