import type { Role } from '@prisma/client';

import { BaseService } from '@/services/base.service';

import { QnaSearchRepository } from './qna-search.repository';
import type { SearchResult } from './qna-search.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the qna-search module. Controllers call into this layer only.
export class QnaSearchService extends BaseService {
  constructor(protected readonly repository: QnaSearchRepository = new QnaSearchRepository()) {
    super();
  }

  async search(q: string, limit: number, actor: Actor): Promise<SearchResult> {
    // Four independent categories — run concurrently rather than sequentially.
    const [questions, tags, courses, lessons] = await Promise.all([
      this.repository.findQuestions(q, limit, actor),
      this.repository.findTags(q, limit, actor),
      this.repository.findCourses(q, limit, actor),
      this.repository.findLessons(q, limit, actor),
    ]);

    return {
      questions: questions.map((question) => ({
        id: question.id,
        title: question.title,
        status: question.status,
        visibility: question.visibility,
        authorName: `${question.author.firstName} ${question.author.lastName}`,
        tags: question.tags.map((questionTag) => questionTag.tag.name),
        answersCount: question._count.answers,
        createdAt: question.createdAt,
      })),
      tags: tags.map((tag) => ({ id: tag.id, name: tag.name, questionCount: tag._count.questions })),
      courses: courses.map((course) => ({ id: course.id, title: course.title })),
      lessons: lessons.map((lesson) => ({ id: lesson.id, title: lesson.title })),
    };
  }
}
