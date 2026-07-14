import type { LessonQuizAttemptStatus, Prisma, Role } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';
import { storageProvider } from '@/storage';
import { logger } from '@/utils/logger';

import { extractTextFromResourceFile } from './content-extractor';
import type { LessonContentForQuiz } from './lesson-quiz.types';

const TEXT_BACKED_RESOURCE_TYPES = new Set(['MARKDOWN', 'CODE_SNIPPET']);

/** File-backed resource types worth extracting text from for quiz generation — PDF/DOCX/PPTX
 * are typical "theory" uploads; VIDEO/IMAGE/ZIP have no reasonably extractable text. */
const EXTRACTABLE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

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
   * Gathers the "quizzable" text this lesson exposes: its own description, every
   * MARKDOWN/CODE_SNIPPET resource's `content` (mirroring `ai/context-builder.ts`'s approach —
   * a direct Prisma query, not an import of that module), PLUS best-effort extracted text from
   * uploaded PDF/DOCX/PPTX resources (see content-extractor.ts) — most real lesson "theory" is
   * uploaded as a file, not pasted as Markdown, so skipping file-backed resources here would
   * leave the quiz gate silently inert for the majority of real lessons.
   */
  async findLessonContentForQuiz(lessonId: string): Promise<LessonContentForQuiz | null> {
    const lesson = await this.db.lesson.findUnique({
      where: { id: lessonId },
      include: { resources: { orderBy: { order: 'asc' } } },
    });
    if (!lesson) return null;

    const textContent = lesson.resources
      .filter((resource) => resource.content && TEXT_BACKED_RESOURCE_TYPES.has(resource.type))
      .map((resource) => resource.content as string);

    const extractableResources = lesson.resources.filter(
      (resource) => resource.relativePath && resource.mimeType && EXTRACTABLE_MIME_TYPES.has(resource.mimeType),
    );
    const extractedContent = await Promise.all(
      extractableResources.map(async (resource) => {
        try {
          const stream = await storageProvider.getReadStream({ relativePath: resource.relativePath as string });
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
