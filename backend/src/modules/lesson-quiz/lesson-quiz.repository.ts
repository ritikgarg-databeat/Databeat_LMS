import type { LessonQuizAttemptStatus, Prisma, Role } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { LessonContentForQuiz } from './lesson-quiz.types';

const TEXT_BACKED_RESOURCE_TYPES = new Set(['MARKDOWN', 'CODE_SNIPPET']);

// Data-access layer for the lesson-quiz module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1). Works directly against Lesson/CourseModule/Course/GroupMember —
// deliberately does not import from the lessons/resources modules (feature-local duplication
// over premature cross-module coupling, matching the progress/resources modules' precedent).
export class LessonQuizRepository extends BaseRepository {
  findAttempt(lessonId: string, userId: string) {
    return this.db.lessonQuizAttempt.findUnique({ where: { lessonId_userId: { lessonId, userId } } });
  }

  createAttempt(data: Prisma.LessonQuizAttemptCreateInput) {
    return this.db.lessonQuizAttempt.create({ data });
  }

  submitAttempt(
    id: string,
    data: {
      status: LessonQuizAttemptStatus;
      selectedAnswers: Prisma.InputJsonValue;
      score: number;
      percentage: number;
      submittedAt: Date;
    },
  ) {
    return this.db.lessonQuizAttempt.update({ where: { id }, data });
  }

  /** Feature-local existence check. */
  findLessonById(lessonId: string) {
    return this.db.lesson.findUnique({ where: { id: lessonId } });
  }

  /**
   * Gathers the same "quizzable" text this lesson exposes to a trainee: its own description
   * plus every MARKDOWN/CODE_SNIPPET resource's `content`, in `order`. Mirrors
   * `ai/context-builder.ts#buildLessonContext`'s approach (a direct Prisma query, not an
   * import of that module) — file-backed resources (PDF/VIDEO/...) never contribute content
   * here, same as there.
   */
  async findLessonContentForQuiz(lessonId: string): Promise<LessonContentForQuiz | null> {
    const lesson = await this.db.lesson.findUnique({
      where: { id: lessonId },
      include: { resources: { orderBy: { order: 'asc' } } },
    });
    if (!lesson) return null;

    const content = lesson.resources
      .filter((resource) => resource.content && TEXT_BACKED_RESOURCE_TYPES.has(resource.type))
      .map((resource) => resource.content)
      .join('\n\n');

    return { lessonTitle: lesson.title, lessonDescription: lesson.description, content };
  }

  /**
   * Self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY),
   * identical to `resources.repository.ts#isLessonAccessibleToUser`: Trainers/Super Admins
   * always have access; any other role needs the lesson's course to be published and not
   * soft-deleted AND assigned to a group the user belongs to, AND the lesson's own module and
   * the lesson itself to both be published.
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
