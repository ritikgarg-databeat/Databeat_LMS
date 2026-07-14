import type { LessonProgressStatus, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

const lessonHierarchyInclude = {
  module: {
    select: { id: true, title: true, isPublished: true, courseId: true },
  },
} satisfies Prisma.LessonInclude;

const continueLearningInclude = {
  lesson: {
    select: {
      id: true,
      title: true,
      module: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
  },
} satisfies Prisma.LessonProgressInclude;

export interface UpsertLessonProgressData {
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: Date;
  completedAt: Date | null;
}

// Data-access layer for the progress module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly. This module
// works directly against Course/CourseModule/Lesson/LessonProgress/GroupMember/
// CourseGroupAssignment — it deliberately does not import from the courses/modules/lessons
// modules (see README.md).
export class ProgressRepository extends BaseRepository {
  findProgress(userId: string, lessonId: string) {
    return this.db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  }

  upsertProgress(userId: string, lessonId: string, data: UpsertLessonProgressData) {
    return this.db.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, ...data },
      update: { ...data },
    });
  }

  findLessonWithHierarchy(lessonId: string) {
    return this.db.lesson.findUnique({ where: { id: lessonId }, include: lessonHierarchyInclude });
  }

  /** A course is accessible to a user iff it's PUBLISHED, not soft-deleted, and assigned to a group the user belongs to. */
  async isCourseAccessibleToUser(userId: string, courseId: string): Promise<boolean> {
    const course = await this.db.course.findFirst({
      where: {
        id: courseId,
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { group: { members: { some: { userId } } } } },
      },
      select: { id: true },
    });
    return course !== null;
  }

  /** Distinct PUBLISHED, non-deleted course ids accessible to a user via their group memberships. */
  async findAccessibleCourseIds(userId: string): Promise<string[]> {
    const courses = await this.db.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { group: { members: { some: { userId } } } } },
      },
      select: { id: true },
    });
    return courses.map((course) => course.id);
  }

  countLessonsForCourses(courseIds: string[]): Promise<number> {
    if (!courseIds.length) return Promise.resolve(0);
    return this.db.lesson.count({
      where: { isPublished: true, module: { isPublished: true, courseId: { in: courseIds } } },
    });
  }

  countCompletedLessonsForUser(userId: string, courseIds: string[]): Promise<number> {
    if (!courseIds.length) return Promise.resolve(0);
    return this.db.lessonProgress.count({
      where: {
        userId,
        status: 'COMPLETED',
        lesson: { isPublished: true, module: { isPublished: true, courseId: { in: courseIds } } },
      },
    });
  }

  async sumTimeSpentForUser(userId: string): Promise<number> {
    const result = await this.db.lessonProgress.aggregate({ where: { userId }, _sum: { timeSpentSeconds: true } });
    return result._sum.timeSpentSeconds ?? 0;
  }

  findContinueLearning(userId: string, limit: number) {
    return this.db.lessonProgress.findMany({
      where: {
        userId,
        status: { not: 'COMPLETED' },
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            course: {
              status: 'PUBLISHED',
              deletedAt: null,
              groupAssignments: { some: { group: { members: { some: { userId } } } } },
            },
          },
        },
      },
      orderBy: { lastViewedAt: 'desc' },
      take: limit,
      include: continueLearningInclude,
    });
  }

  findCourseById(courseId: string) {
    return this.db.course.findUnique({ where: { id: courseId } });
  }

  findPublishedModulesWithLessons(courseId: string) {
    return this.db.courseModule.findMany({
      where: { courseId, isPublished: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        lessons: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          select: { id: true, title: true },
        },
      },
    });
  }

  findProgressForLessons(userId: string, lessonIds: string[]) {
    if (!lessonIds.length) return Promise.resolve([]);
    return this.db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } } });
  }
}
