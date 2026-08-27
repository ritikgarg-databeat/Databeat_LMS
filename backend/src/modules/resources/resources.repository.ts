import type { Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { trainerCourseCatalogScope, trainerCourseScope } from '@/policies/trainer-scope.policy';
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

  findProgress(userId: string, resourceId: string) {
    return this.db.lessonResourceProgress.findUnique({
      where: { userId_resourceId: { userId, resourceId } },
    });
  }

  upsertProgress(
    userId: string,
    resourceId: string,
    data: Prisma.LessonResourceProgressUncheckedCreateInput,
  ) {
    const { id: _id, userId: _userId, resourceId: _resourceId, ...values } = data;
    return this.db.lessonResourceProgress.upsert({
      where: { userId_resourceId: { userId, resourceId } },
      create: { ...values, userId, resourceId },
      update: values,
    });
  }

  async findNextOrder(lessonId: string): Promise<number> {
    const top = await this.db.lessonResource.findFirst({
      where: { lessonId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return top ? top.order + 1 : 0;
  }

  /** Creates content, advances the lesson version, and reopens completed learners atomically. */
  createAndInvalidateLearning(lessonId: string, data: Prisma.LessonResourceCreateInput) {
    return this.db.$transaction(async (tx) => {
      const resource = await tx.lessonResource.create({ data });
      const lesson = await tx.lesson.update({
        where: { id: lessonId },
        data: { contentVersion: { increment: 1 } },
        select: { contentVersion: true },
      });
      const reopenedProgress = await tx.lessonProgress.updateMany({
        where: { lessonId, status: 'COMPLETED' },
        data: { status: 'IN_PROGRESS', completedAt: null },
      });
      const invalidatedQuizCount = await tx.lessonQuizAttempt.count({ where: { lessonId } });

      return {
        resource,
        contentVersion: lesson.contentVersion,
        reopenedLearnerCount: reopenedProgress.count,
        invalidatedQuizCount,
      };
    });
  }

  /** Removes content with the same version/recompletion semantics as adding content. */
  deleteAndInvalidateLearning(lessonId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const resource = await tx.lessonResource.delete({ where: { id } });
      const lesson = await tx.lesson.update({
        where: { id: lessonId },
        data: { contentVersion: { increment: 1 } },
        select: { contentVersion: true },
      });
      const reopenedProgress = await tx.lessonProgress.updateMany({
        where: { lessonId, status: 'COMPLETED' },
        data: { status: 'IN_PROGRESS', completedAt: null },
      });
      const invalidatedQuizCount = await tx.lessonQuizAttempt.count({ where: { lessonId } });

      return {
        resource,
        contentVersion: lesson.contentVersion,
        reopenedLearnerCount: reopenedProgress.count,
        invalidatedQuizCount,
      };
    });
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
    if (role === 'SUPER_ADMIN') {
      return (await this.db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } })) !== null;
    }
    if (role === 'TRAINER') {
      const lesson = await this.db.lesson.findFirst({
        where: {
          id: lessonId,
          module: { course: { AND: [{ deletedAt: null }, trainerCourseCatalogScope(userId)] } },
        },
        select: { id: true },
      });
      return lesson !== null;
    }

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
      where: activeGroupMembershipWhere(userId, {
        courseAssignments: { some: { courseId: course.id } },
      }),
    });
    return membership !== null;
  }

  async isLessonManageableByTrainer(lessonId: string, trainerId: string): Promise<boolean> {
    const lesson = await this.db.lesson.findFirst({
      where: { id: lessonId, module: { course: { deletedAt: null, ...trainerCourseScope(trainerId) } } },
      select: { id: true },
    });
    return lesson !== null;
  }
}
