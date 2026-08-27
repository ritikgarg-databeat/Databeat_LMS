import type { Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { trainerCourseCatalogScope, trainerCourseScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { ReorderItem } from './lessons.types';

const resourceCountInclude = {
  _count: { select: { resources: true } },
} satisfies Prisma.LessonInclude;

// Data-access layer for the lessons module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class LessonsRepository extends BaseRepository {
  findByModuleId(moduleId: string) {
    return this.db.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: resourceCountInclude,
    });
  }

  findById(id: string) {
    return this.db.lesson.findUnique({ where: { id } });
  }

  /** File pointers must be captured before the lesson delete cascades its resource rows. */
  findFileResourcesByLessonId(lessonId: string) {
    return this.db.lessonResource.findMany({
      where: { lessonId, relativePath: { not: null } },
      select: { id: true, relativePath: true },
    });
  }

  findVideoDraftsByLessonId(lessonId: string) {
    return this.db.videoGenerationJob.findMany({
      where: { lessonId, status: { not: 'PUBLISHED' } },
      select: {
        id: true,
        artifactRelativePath: true,
        captionRelativePath: true,
        thumbnailRelativePath: true,
        audioArtifacts: true,
      },
    });
  }

  /**
   * Flat lookup for `GET /lessons/:id`, used by both the trainer editor and the trainee
   * viewer (Prompt 5). `progress` is scoped to `userId` so it resolves to at most one row —
   * the caller (LessonsService) takes `progress[0] ?? null`.
   */
  findDetailedById(id: string, userId: string) {
    return this.db.lesson.findUnique({
      where: { id },
      include: {
        resources: {
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId } } },
        },
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true, status: true, isMandatory: true } },
          },
        },
        progress: { where: { userId } },
      },
    });
  }

  findManyByIds(moduleId: string, ids: string[]) {
    return this.db.lesson.findMany({ where: { moduleId, id: { in: ids } }, select: { id: true } });
  }

  /** Used to confirm a reorder submits EVERY sibling lesson, not a partial subset (would otherwise leave stale/duplicate `order` values on the untouched rest). */
  countByModuleId(moduleId: string) {
    return this.db.lesson.count({ where: { moduleId } });
  }

  /** Feature-local existence check — the modules module owns CourseModule but isn't a dependency here. */
  findModuleById(moduleId: string) {
    return this.db.courseModule.findUnique({ where: { id: moduleId } });
  }

  async isModuleInTrainerScope(moduleId: string, trainerId: string): Promise<boolean> {
    const courseModule = await this.db.courseModule.findFirst({
      where: { id: moduleId, course: { deletedAt: null, ...trainerCourseScope(trainerId) } },
      select: { id: true },
    });
    return courseModule !== null;
  }

  async isLessonInTrainerScope(lessonId: string, trainerId: string): Promise<boolean> {
    const lesson = await this.db.lesson.findFirst({
      where: {
        id: lessonId,
        module: { course: { deletedAt: null, ...trainerCourseScope(trainerId) } },
      },
      select: { id: true },
    });
    return lesson !== null;
  }

  async isModuleReadableByTrainer(moduleId: string, trainerId: string): Promise<boolean> {
    const courseModule = await this.db.courseModule.findFirst({
      where: {
        id: moduleId,
        course: { AND: [{ deletedAt: null }, trainerCourseCatalogScope(trainerId)] },
      },
      select: { id: true },
    });
    return courseModule !== null;
  }

  async isLessonReadableByTrainer(lessonId: string, trainerId: string): Promise<boolean> {
    const lesson = await this.db.lesson.findFirst({
      where: {
        id: lessonId,
        module: { course: { AND: [{ deletedAt: null }, trainerCourseCatalogScope(trainerId)] } },
      },
      select: { id: true },
    });
    return lesson !== null;
  }

  async isCourseMandatoryForUser(courseId: string, userId: string): Promise<boolean> {
    const assignment = await this.db.courseGroupAssignment.findFirst({
      where: {
        courseId,
        isMandatory: true,
        group: { status: 'ACTIVE', deletedAt: null, members: { some: { userId } } },
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  async findNextOrder(moduleId: string): Promise<number> {
    const top = await this.db.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return top ? top.order + 1 : 0;
  }

  create(data: Prisma.LessonCreateInput) {
    return this.db.lesson.create({ data });
  }

  update(id: string, data: Prisma.LessonUpdateInput) {
    return this.db.lesson.update({ where: { id }, data });
  }

  updateAndInvalidateLearning(id: string, data: Prisma.LessonUpdateInput) {
    return this.db.$transaction(async (tx) => {
      const lesson = await tx.lesson.update({
        where: { id },
        data: { ...data, contentVersion: { increment: 1 } },
      });
      const reopenedProgress = await tx.lessonProgress.updateMany({
        where: { lessonId: id, status: 'COMPLETED' },
        data: { status: 'IN_PROGRESS', completedAt: null },
      });
      const invalidatedQuizCount = await tx.lessonQuizAttempt.count({ where: { lessonId: id } });
      return {
        lesson,
        reopenedLearnerCount: reopenedProgress.count,
        invalidatedQuizCount,
      };
    });
  }

  delete(id: string) {
    return this.db.lesson.delete({ where: { id } });
  }

  reorder(updates: ReorderItem[]) {
    return this.db.$transaction(
      updates.map(({ id, order }) => this.db.lesson.update({ where: { id }, data: { order } })),
    );
  }

  /**
   * Stable contract consumed by the resources and progress modules (built in parallel —
   * Prompt 5 § SECURITY). Trainers/Super Admins always have access; a Trainee needs the
   * lesson's course to be published and group-assigned to them, AND the lesson's own module
   * and the lesson itself to both be published.
   */
  async isAccessibleToUser(lessonId: string, userId: string, role: Role): Promise<boolean> {
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
      where: activeGroupMembershipWhere(userId, {
        courseAssignments: { some: { courseId: course.id } },
      }),
    });
    return membership !== null;
  }
}
