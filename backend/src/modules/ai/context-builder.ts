import type { Prisma, Role } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  AI_CONTEXT_MAX_COURSES,
  AI_CONTEXT_MAX_LEARNING_SCOPE_CHARS,
  AI_CONTEXT_MAX_LESSON_CONTENT_CHARS,
  AI_DOCUMENT_TEXT_CACHE_MAX_ENTRIES,
} from '@/constants/ai';
import { activeGroupScope } from '@/policies/group-access.policy';
import { storageProvider } from '@/storage';
import {
  EXTRACTABLE_DOCUMENT_MIME_TYPES,
  extractTextFromResourceFile,
} from '@/utils/document-text-extractor';
import { logger } from '@/utils/logger';

import type { AiGroundingSource, LearningScopeContext, LessonContext } from './ai.types';

const TEXT_BACKED_RESOURCE_TYPES = new Set(['MARKDOWN', 'CODE_SNIPPET']);

interface CachedDocumentText {
  version: string;
  text: string;
}

/** Small process-local cache; resource.updatedAt invalidates changed documents automatically. */
const documentTextCache = new Map<string, CachedDocumentText>();

function findLesson(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { select: { title: true } } } },
      resources: { orderBy: { order: 'asc' } },
    },
  });
}

type LessonResourceRow = NonNullable<Awaited<ReturnType<typeof findLesson>>>['resources'][number];

async function getResourceText(resource: LessonResourceRow): Promise<string> {
  if (resource.content && TEXT_BACKED_RESOURCE_TYPES.has(resource.type)) return resource.content.trim();
  if (
    !resource.relativePath ||
    !resource.mimeType ||
    !EXTRACTABLE_DOCUMENT_MIME_TYPES.has(resource.mimeType)
  ) {
    return '';
  }

  const version = resource.updatedAt.toISOString();
  const cached = documentTextCache.get(resource.id);
  if (cached?.version === version) return cached.text;

  let text = '';
  try {
    const stream = await storageProvider.getReadStream({ relativePath: resource.relativePath });
    text = (await extractTextFromResourceFile(stream, resource.mimeType)).trim();
  } catch (error) {
    logger.warn('Failed to read lesson resource while building AI tutor context', {
      error,
      resourceId: resource.id,
    });
  }

  if (documentTextCache.size >= AI_DOCUMENT_TEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = documentTextCache.keys().next().value as string | undefined;
    if (oldestKey) documentTextCache.delete(oldestKey);
  }
  documentTextCache.set(resource.id, { version, text });
  return text;
}

/**
 * Builds source-labelled lesson context from title, description, Markdown/code, and extracted
 * PDF/DOCX/PPTX text. Source labels let the response guard verify that an accepted answer points
 * back to material actually present in this lesson.
 */
export async function buildLessonContext(lessonId: string): Promise<LessonContext | null> {
  const lesson = await findLesson(lessonId);
  if (!lesson) return null;

  const resourceTexts = await Promise.all(lesson.resources.map((resource) => getResourceText(resource)));
  const groundingSources: AiGroundingSource[] = [];

  if (lesson.description?.trim()) {
    groundingSources.push({
      id: 'lesson-description',
      label: 'Lesson description',
      content: lesson.description.trim(),
    });
  }

  lesson.resources.forEach((resource, index) => {
    const content = resourceTexts[index]?.trim();
    if (!content) return;
    groundingSources.push({
      id: `resource-${index + 1}`,
      label: `${resource.title} (${resource.type})`,
      content,
    });
  });

  let remainingChars = AI_CONTEXT_MAX_LESSON_CONTENT_CHARS;
  const boundedSources = groundingSources.flatMap((source) => {
    if (remainingChars <= 0) return [];
    const content = source.content.slice(0, remainingChars);
    remainingChars -= content.length;
    return content ? [{ ...source, content }] : [];
  });

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonDescription: lesson.description ?? undefined,
    moduleName: lesson.module.title,
    courseName: lesson.module.course.title,
    lessonContent: boundedSources.map((source) => source.content).join('\n\n') || undefined,
    resources: lesson.resources.map((resource) => ({
      title: resource.title,
      type: resource.type,
      filename: resource.originalFilename ?? undefined,
    })),
    groundingSources: boundedSources,
  };
}

/**
 * Builds the permitted topic catalog for the main tutor. Trainees see only published courses
 * assigned through their groups; trainers see their own/assigned courses; Super Admins see all
 * published courses. This catalog constrains relevance but is not treated as lesson evidence.
 */
export async function buildLearningScopeContext(userId: string, role: Role): Promise<LearningScopeContext> {
  const courseWhere: Prisma.CourseWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    ...(role === 'TRAINEE'
      ? {
          groupAssignments: {
            some: { group: activeGroupScope({ members: { some: { userId } } }) },
          },
        }
      : role === 'TRAINER'
        ? {
            OR: [
              { createdById: userId },
              { groupAssignments: { some: { group: activeGroupScope({ trainerId: userId }) } } },
            ],
          }
        : {}),
  };

  const [user, courses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { department: { select: { name: true } } },
    }),
    prisma.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      take: AI_CONTEXT_MAX_COURSES,
      select: {
        title: true,
        description: true,
        department: { select: { name: true } },
        modules: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          select: {
            title: true,
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: { title: true },
            },
          },
        },
      },
    }),
  ]);

  let remainingChars = AI_CONTEXT_MAX_LEARNING_SCOPE_CHARS;
  const scopedCourses = courses.flatMap((course, index) => {
    if (remainingChars <= course.title.length) return [];
    remainingChars -= course.title.length;

    const description = course.description?.slice(0, Math.min(1000, remainingChars));
    remainingChars -= description?.length ?? 0;

    const allModuleAndLessonTitles = course.modules.flatMap((courseModule) => [
      courseModule.title,
      ...courseModule.lessons.map((lesson) => lesson.title),
    ]);
    const moduleAndLessonTitles: string[] = [];
    for (const title of allModuleAndLessonTitles) {
      if (title.length > remainingChars) break;
      moduleAndLessonTitles.push(title);
      remainingChars -= title.length;
    }

    return [
      {
        evidenceId: `course-${index + 1}`,
        title: course.title,
        description: description || undefined,
        departmentName: course.department?.name,
        moduleAndLessonTitles,
      },
    ];
  });

  return { departmentName: user?.department?.name, courses: scopedCourses };
}
