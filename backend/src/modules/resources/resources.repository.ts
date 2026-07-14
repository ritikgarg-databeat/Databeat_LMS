import type { Prisma, Role } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

// Data-access layer for the resources module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly. This module
// works directly against Lesson/CourseModule/Course/GroupMember/CourseGroupAssignment for its
// accessibility check — it deliberately does not import from the lessons module (feature-local
// duplication over premature cross-module coupling, mirroring the progress module's precedent).
export class ResourcesRepository extends BaseRepository {
  findByLessonId(lessonId: string) {
    return this.db.lessonResource.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string) {
    return this.db.lessonResource.findUnique({ where: { id } });
  }

  async findNextOrder(lessonId: string): Promise<number> {
    const top = await this.db.lessonResource.findFirst({
      where: { lessonId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return top ? top.order + 1 : 0;
  }

  create(data: Prisma.LessonResourceCreateInput) {
    return this.db.lessonResource.create({ data });
  }

  delete(id: string) {
    return this.db.lessonResource.delete({ where: { id } });
  }

  /** Feature-local existence check — the lessons module owns Lesson but isn't a dependency here. */
  findLessonById(lessonId: string) {
    return this.db.lesson.findUnique({ where: { id: lessonId } });
  }

  /**
   * Self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY),
   * identical to `LessonsRepository#isAccessibleToUser`: Trainers/Super Admins always have
   * access; any other role needs the lesson's course to be published and not soft-deleted AND
   * assigned to a group the user belongs to, AND the lesson's own module and the lesson itself
   * to both be published.
   */
  async isLessonAccessibleToUser(lessonId: string, userId: string, role: Role): Promise<boolean> {
    if (role === 'TRAINER' || role === 'SUPER_ADMIN') return true;

    const lesson = await this.db.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!lesson) return false;
    if (!lesson.isPublished) return false;
    if (!lesson.module.isPublished) return false;

    const { course } = lesson.module;
    if (course.status !== 'PUBLISHED' || course.deletedAt !== null) return false;

    const membership = await this.db.groupMember.findFirst({
      where: { userId, group: { courseAssignments: { some: { courseId: course.id } } } },
    });
    return membership !== null;
  }
}
