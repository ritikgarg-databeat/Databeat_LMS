import { LessonProgressStatus, type Role } from '@prisma/client';

import { LessonQuizService } from '@/modules/lesson-quiz';
import { BaseService } from '@/services/base.service';
import { ForbiddenError, NotFoundError } from '@/utils/app-error';
import { hasNewLessonContent } from '@/utils/lesson-content-status.util';

import type { UpsertLessonProgressDto } from './progress.dto';
import { ProgressRepository } from './progress.repository';
import type {
  ContinueLearningItem,
  CourseModuleProgress,
  CourseProgressBreakdown,
  LessonProgressView,
  ProgressSummary,
} from './progress.types';

interface Actor {
  id: string;
  role: Role;
}

type LessonWithHierarchy = NonNullable<Awaited<ReturnType<ProgressRepository['findLessonWithHierarchy']>>>;
const MAX_TIME_SPENT_DELTA_SECONDS = 60;

// Business logic for the progress module. Controllers call into this layer only.
//
// This module owns the LessonProgress model exclusively and implements its own,
// self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY)
// rather than importing from the courses/modules/lessons modules — see README.md.
export class ProgressService extends BaseService {
  constructor(
    protected readonly repository: ProgressRepository = new ProgressRepository(),
    private readonly lessonQuiz: LessonQuizService = new LessonQuizService(),
  ) {
    super();
  }

  async getLessonProgress(lessonId: string, actor: Actor): Promise<LessonProgressView> {
    const lesson = await this.assertLessonAccessible(lessonId, actor);

    const [progress, latestResource] = await Promise.all([
      this.repository.findProgress(actor.id, lessonId),
      this.repository.findLatestResourceCreatedAt(lessonId),
    ]);
    if (!progress) {
      return {
        status: LessonProgressStatus.NOT_STARTED,
        timeSpentSeconds: 0,
        lastViewedAt: null,
        completedAt: null,
        completedContentVersion: null,
        currentContentVersion: lesson.contentVersion,
        hasNewContent: false,
      };
    }

    return {
      status: progress.status,
      timeSpentSeconds: progress.timeSpentSeconds,
      lastViewedAt: progress.lastViewedAt,
      completedAt: progress.completedAt,
      completedContentVersion: progress.completedContentVersion,
      currentContentVersion: lesson.contentVersion,
      hasNewContent:
        (progress.completedContentVersion !== null && progress.completedContentVersion < lesson.contentVersion) ||
        hasNewLessonContent(latestResource?.createdAt, progress.lastViewedAt),
    };
  }

  async upsertLessonProgress(
    lessonId: string,
    actor: Actor,
    dto: UpsertLessonProgressDto,
  ): Promise<LessonProgressView> {
    const lesson = await this.assertLessonAccessible(lessonId, actor);

    const existing = await this.repository.findProgress(actor.id, lessonId);
    const now = new Date();

    const status = dto.status ?? existing?.status ?? LessonProgressStatus.IN_PROGRESS;
    const acceptedTimeDelta = Math.min(dto.timeSpentSecondsDelta ?? 0, MAX_TIME_SPENT_DELTA_SECONDS);
    const timeSpentSeconds = (existing?.timeSpentSeconds ?? 0) + acceptedTimeDelta;
    let completedAt = existing?.completedAt ?? null;
    let completedContentVersion = existing?.completedContentVersion ?? null;
    if (
      status === LessonProgressStatus.COMPLETED &&
      (!completedAt || completedContentVersion !== lesson.contentVersion)
    ) {
      // Throws (403) if this lesson has quiz-worthy content and the trainee hasn't submitted
      // it yet — generates the quiz on first ask, closing the "never open the quiz UI" bypass.
      // See modules/lesson-quiz/README.md § The completion gate.
      await this.lessonQuiz.checkCompletionGate(lessonId, actor);
      completedAt = now;
      completedContentVersion = lesson.contentVersion;
    }

    const updated = await this.repository.upsertProgress(actor.id, lessonId, {
      status,
      timeSpentSeconds,
      lastViewedAt: now,
      completedAt,
      completedContentVersion,
    });

    return {
      status: updated.status,
      timeSpentSeconds: updated.timeSpentSeconds,
      lastViewedAt: updated.lastViewedAt,
      completedAt: updated.completedAt,
      completedContentVersion: updated.completedContentVersion,
      currentContentVersion: lesson.contentVersion,
      hasNewContent: false,
    };
  }

  async getContinueLearning(userId: string, limit: number): Promise<ContinueLearningItem[]> {
    const rows = await this.repository.findContinueLearning(userId, limit);

    return rows.map((row) => ({
      lessonId: row.lesson.id,
      lessonTitle: row.lesson.title,
      moduleId: row.lesson.module.id,
      moduleTitle: row.lesson.module.title,
      courseId: row.lesson.module.course.id,
      courseTitle: row.lesson.module.course.title,
      status: row.status,
      timeSpentSeconds: row.timeSpentSeconds,
      lastViewedAt: row.lastViewedAt,
      hasNewContent:
        (row.completedContentVersion !== null && row.completedContentVersion < row.lesson.contentVersion) ||
        hasNewLessonContent(row.lesson.resources[0]?.createdAt, row.lastViewedAt),
    }));
  }

  async getSummary(userId: string): Promise<ProgressSummary> {
    const courseIds = await this.repository.findAccessibleCourseIds(userId);

    const [totalLessonsCount, completedLessonsCount, totalTimeSpentSeconds] = await Promise.all([
      this.repository.countLessonsForCourses(courseIds),
      this.repository.countCompletedLessonsForUser(userId, courseIds),
      this.repository.sumTimeSpentForUser(userId),
    ]);

    const overallCompletionPercentage =
      totalLessonsCount === 0 ? 0 : Math.round((completedLessonsCount / totalLessonsCount) * 100);
    const hoursSpent = Math.round((totalTimeSpentSeconds / 3600) * 10) / 10;

    return {
      assignedCoursesCount: courseIds.length,
      overallCompletionPercentage,
      completedLessonsCount,
      totalLessonsCount,
      hoursSpent,
    };
  }

  async getCourseProgress(courseId: string, actor: Actor): Promise<CourseProgressBreakdown> {
    const isStaff = actor.role !== 'TRAINEE';

    if (isStaff) {
      const course = await this.repository.findCourseById(courseId);
      if (!course) throw new NotFoundError('Course not found.');
      if (
        actor.role === 'TRAINER' &&
        !(await this.repository.isCourseInTrainerScope(actor.id, courseId))
      ) {
        throw new ForbiddenError("You don't have permission to view this course's progress.");
      }
    } else {
      const accessible = await this.repository.isCourseAccessibleToUser(actor.id, courseId);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this course's progress.");
    }

    const modules = await this.repository.findPublishedModulesWithLessons(courseId);
    const lessonIds = modules.flatMap((courseModule) => courseModule.lessons.map((lesson) => lesson.id));

    // A Trainer/Super-Admin previewing their own course has no learner progress of their own —
    // return zeroed-out progress rather than erroring (Prompt 5 § PROGRESS TRACKING).
    const progressRows = isStaff ? [] : await this.repository.findProgressForLessons(actor.id, lessonIds);
    const progressByLessonId = new Map(progressRows.map((row) => [row.lessonId, row]));

    const moduleBreakdowns: CourseModuleProgress[] = modules.map((courseModule) => {
      const lessons = courseModule.lessons.map((lesson) => {
        const progress = progressByLessonId.get(lesson.id);
        return {
          lessonId: lesson.id,
          title: lesson.title,
          status: progress?.status ?? LessonProgressStatus.NOT_STARTED,
          timeSpentSeconds: progress?.timeSpentSeconds ?? 0,
          hasNewContent: progress
            ? (progress.completedContentVersion !== null &&
                progress.completedContentVersion < lesson.contentVersion) ||
              hasNewLessonContent(lesson.resources[0]?.createdAt, progress.lastViewedAt)
            : false,
        };
      });
      const completedCount = lessons.filter(
        (lesson) => lesson.status === LessonProgressStatus.COMPLETED,
      ).length;
      const percentage = lessons.length === 0 ? 0 : Math.round((completedCount / lessons.length) * 100);

      return { moduleId: courseModule.id, title: courseModule.title, percentage, lessons };
    });

    const totalLessons = moduleBreakdowns.reduce((sum, courseModule) => sum + courseModule.lessons.length, 0);
    const totalCompleted = moduleBreakdowns.reduce(
      (sum, courseModule) =>
        sum +
        courseModule.lessons.filter((lesson) => lesson.status === LessonProgressStatus.COMPLETED).length,
      0,
    );
    const overallPercentage = totalLessons === 0 ? 0 : Math.round((totalCompleted / totalLessons) * 100);

    return { courseId, overallPercentage, modules: moduleBreakdowns };
  }

  /**
   * Self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY):
   * a lesson is accessible if its course is accessible (PUBLISHED, not deleted, assigned to a
   * group the user is a member of) and — for a Trainee specifically — the lesson and its module
   * are both published. Trainers/Super Admins bypass all of this. A Trainee never learns whether
   * an inaccessible/nonexistent lessonId exists — always a 403, never a 404.
   */
  private async assertLessonAccessible(lessonId: string, actor: Actor): Promise<LessonWithHierarchy> {
    const lesson = await this.repository.findLessonWithHierarchy(lessonId);

    if (actor.role !== 'TRAINEE') {
      if (!lesson) throw new NotFoundError('Lesson not found.');
      if (
        actor.role === 'TRAINER' &&
        !(await this.repository.isCourseInTrainerScope(actor.id, lesson.module.courseId))
      ) {
        throw new ForbiddenError("You don't have permission to access this lesson.");
      }
      return lesson;
    }

    if (!lesson || !lesson.isPublished || !lesson.module.isPublished) {
      throw new ForbiddenError("You don't have permission to access this lesson.");
    }

    const courseAccessible = await this.repository.isCourseAccessibleToUser(actor.id, lesson.module.courseId);
    if (!courseAccessible) {
      throw new ForbiddenError("You don't have permission to access this lesson.");
    }

    return lesson;
  }
}
