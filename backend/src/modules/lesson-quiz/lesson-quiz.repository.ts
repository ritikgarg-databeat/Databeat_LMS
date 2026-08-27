import type { LessonQuizAttemptStatus, Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { trainerCourseCatalogScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';
import { storageProvider } from '@/storage';
import {
  EXTRACTABLE_DOCUMENT_MIME_TYPES,
  extractTextFromResourceFile,
} from '@/utils/document-text-extractor';
import { logger } from '@/utils/logger';

import type { LessonContentForQuiz } from './lesson-quiz.types';

const TEXT_BACKED_RESOURCE_TYPES = new Set(['MARKDOWN', 'CODE_SNIPPET']);

// Data-access layer for the lesson-quiz module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1). Works directly against Lesson/CourseModule/Course/GroupMember —
// deliberately does not import from the lessons/resources modules (feature-local duplication
// over premature cross-module coupling, matching the progress/resources modules' precedent).
export class LessonQuizRepository extends BaseRepository {
  findAttempt(lessonId: string, userId: string, contentVersion: number) {
    return this.db.lessonQuizAttempt.findFirst({
      where: { lessonId, userId, contentVersion },
      orderBy: { attemptNumber: 'desc' },
    });
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

  /** Feature-local read of LessonProgress — used by getOrCreateAttempt to avoid generating a
   * fresh (never-submitted) quiz attempt for a lesson this user already completed (see that
   * method's doc comment for why this matters). */
  async isLessonAlreadyCompleted(lessonId: string, userId: string, contentVersion: number): Promise<boolean> {
    const progress = await this.db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { status: true, completedContentVersion: true },
    });
    return progress?.status === 'COMPLETED' && progress.completedContentVersion === contentVersion;
  }

  /**
   * Gathers the "quizzable" text this lesson exposes: its own description, every
   * MARKDOWN/CODE_SNIPPET resource's `content` (mirroring `ai/context-builder.ts`'s approach —
   * a direct Prisma query, not an import of that module), PLUS best-effort extracted text from
   * uploaded PDF/DOCX/PPTX resources (see utils/document-text-extractor.ts) — most real lesson "theory" is
   * uploaded as a file, not pasted as Markdown, so skipping file-backed resources here would
   * leave the quiz gate silently inert for the majority of real lessons.
   */
  async findLessonContentForQuiz(lessonId: string, userId?: string): Promise<LessonContentForQuiz | null> {
    const lesson = await this.db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        resources: { orderBy: { order: 'asc' } },
        module: {
          select: {
            course: {
              select: {
                isMandatory: true,
                groupAssignments: {
                  where: userId
                    ? {
                        isMandatory: true,
                        group: { status: 'ACTIVE', deletedAt: null, members: { some: { userId } } },
                      }
                    : { id: '__not-used__' },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!lesson) return null;

    const textContent = lesson.resources
      .filter((resource) => resource.content && TEXT_BACKED_RESOURCE_TYPES.has(resource.type))
      .map((resource) => resource.content as string);

    const extractableResources = lesson.resources.filter(
      (resource) =>
        resource.relativePath && resource.mimeType && EXTRACTABLE_DOCUMENT_MIME_TYPES.has(resource.mimeType),
    );
    const extractedContent = await Promise.all(
      extractableResources.map(async (resource) => {
        try {
          const stream = await storageProvider.getReadStream({
            relativePath: resource.relativePath as string,
          });
          return await extractTextFromResourceFile(stream, resource.mimeType);
        } catch (error) {
          logger.warn('Failed to read lesson resource file for quiz generation', {
            error,
            resourceId: resource.id,
          });
          return '';
        }
      }),
    );

    const content = [...textContent, ...extractedContent].filter(Boolean).join('\n\n');
    const fileResourceCount = lesson.resources.filter((resource) => resource.relativePath).length;
    const successfullyExtractedFileCount = extractedContent.filter((text) => text.trim().length > 0).length;

    return {
      lessonTitle: lesson.title,
      lessonDescription: lesson.description,
      content,
      contentVersion: lesson.contentVersion,
      isMandatory: userId
        ? lesson.module.course.groupAssignments.length > 0
        : lesson.module.course.isMandatory,
      hasOpaqueFileContent: fileResourceCount > successfullyExtractedFileCount,
    };
  }

  /**
   * Self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY),
   * identical to `resources.repository.ts#isLessonAccessibleToUser`: Trainers/Super Admins
   * always have access; any other role needs the lesson's course to be published and not
   * soft-deleted AND assigned to a group the user belongs to, AND the lesson's own module and
   * the lesson itself to both be published.
   */
  async isLessonAccessibleToUser(lessonId: string, userId: string, role: Role): Promise<boolean> {
    if (role === 'SUPER_ADMIN') {
      return (await this.db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } })) !== null;
    }
    if (role === 'TRAINER') {
      return (
        (await this.db.lesson.findFirst({
          where: {
            id: lessonId,
            module: { course: { AND: [{ deletedAt: null }, trainerCourseCatalogScope(userId)] } },
          },
          select: { id: true },
        })) !== null
      );
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
    if (!membership) return false;
    const mandatoryAssignment = await this.db.courseGroupAssignment.findFirst({
      where: {
        courseId: course.id,
        isMandatory: true,
        group: { status: 'ACTIVE', deletedAt: null, members: { some: { userId } } },
      },
      select: { id: true },
    });
    if (!mandatoryAssignment) return true;

    const sequence = await this.db.lesson.findMany({
      where: {
        isPublished: true,
        module: { courseId: course.id, isPublished: true },
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        contentVersion: true,
        progress: {
          where: { userId },
          take: 1,
          select: { status: true, completedContentVersion: true },
        },
      },
    });
    const requestedIndex = sequence.findIndex((item) => item.id === lessonId);
    const firstIncompleteIndex = sequence.findIndex((item) => {
      const progress = item.progress[0];
      return progress?.status !== 'COMPLETED' || progress.completedContentVersion !== item.contentVersion;
    });
    return requestedIndex >= 0 && (firstIncompleteIndex < 0 || requestedIndex <= firstIncompleteIndex);
  }
}
