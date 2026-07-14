import { prisma } from '@/config/prisma';
import { AI_CONTEXT_MAX_LESSON_CONTENT_CHARS } from '@/constants/ai';

import type { LessonContext } from './ai.types';

const TEXT_BACKED_RESOURCE_TYPES = new Set(['MARKDOWN', 'CODE_SNIPPET']);

/**
 * Lesson Context System (Prompt 7 § LESSON CONTEXT SYSTEM). Fetches lesson title/description,
 * module name, course name, the lesson's own text-backed content, and metadata for every
 * attached resource — a direct Prisma query, not an import of the courses/lessons module's
 * repositories, per this codebase's established feature-local-duplication convention (see
 * assessment-attempts/resources modules' self-contained `isAccessibleToUser` copies).
 *
 * Only text-backed resource content (MARKDOWN/CODE_SNIPPET) is inlined into the prompt —
 * file-backed resources (PDF/VIDEO/IMAGE/...) contribute title/type/filename only ("available
 * resources metadata" per spec), never their binary content.
 */
export async function buildLessonContext(lessonId: string): Promise<LessonContext | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { select: { title: true } } } },
      resources: { orderBy: { order: 'asc' } },
    },
  });
  if (!lesson) return null;

  const lessonContent = lesson.resources
    .filter((resource) => resource.content && TEXT_BACKED_RESOURCE_TYPES.has(resource.type))
    .map((resource) => resource.content)
    .join('\n\n')
    .slice(0, AI_CONTEXT_MAX_LESSON_CONTENT_CHARS);

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonDescription: lesson.description ?? undefined,
    moduleName: lesson.module.title,
    courseName: lesson.module.course.title,
    lessonContent: lessonContent || undefined,
    resources: lesson.resources.map((resource) => ({
      title: resource.title,
      type: resource.type,
      filename: resource.originalFilename ?? undefined,
    })),
  };
}
