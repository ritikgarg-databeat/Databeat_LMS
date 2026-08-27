import type { Prisma, Role } from '@prisma/client';

import { AI_CONVERSATION_MESSAGES_MAX } from '@/constants/ai';
import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { trainerCourseCatalogScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { AiConversationListFilters } from './ai.types';

// Data-access layer for the ai module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class AiRepository extends BaseRepository {
  createConversation(data: Prisma.AiConversationCreateInput) {
    return this.db.aiConversation.create({ data });
  }

  findConversationById(id: string) {
    return this.db.aiConversation.findUnique({ where: { id } });
  }

  /**
   * Bounded to the MOST RECENT `AI_CONVERSATION_MESSAGES_MAX` messages (fetched desc — the
   * service reverses back to chronological). The write path never caps conversation length,
   * so this detail fetch is the one place an unbounded query could grow with usage.
   */
  findConversationWithMessages(id: string) {
    return this.db.aiConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: AI_CONVERSATION_MESSAGES_MAX,
          include: { videoGenerationJob: true },
        },
      },
    });
  }

  /** Most-recent-first — callers reverse to chronological order before sending to the provider. */
  findRecentMessages(conversationId: string, take: number) {
    return this.db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findMany(userId: string, filters: AiConversationListFilters, skip: number, take: number) {
    const where: Prisma.AiConversationWhereInput = {
      userId,
      ...(filters.lessonId ? { lessonId: filters.lessonId } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.aiConversation.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          lesson: { select: { id: true, title: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.db.aiConversation.count({ where }),
    ]);
    return { items, total };
  }

  createMessage(data: Prisma.AiMessageCreateInput) {
    return this.db.aiMessage.create({ data });
  }

  deleteMessages(ids: string[]) {
    return this.db.aiMessage.deleteMany({ where: { id: { in: ids } } });
  }

  async findTraineeVideoJobIdsForConversation(conversationId: string, userId: string) {
    const messages = await this.db.aiMessage.findMany({
      where: { conversationId, conversation: { userId }, videoGenerationJob: { isNot: null } },
      select: { videoGenerationJob: { select: { id: true } } },
    });
    return messages.flatMap((message) => message.videoGenerationJob?.id ?? []);
  }

  async findTraineeVideoJobIdsForUser(userId: string) {
    const messages = await this.db.aiMessage.findMany({
      where: { conversation: { userId }, videoGenerationJob: { isNot: null } },
      select: { videoGenerationJob: { select: { id: true } } },
    });
    return messages.flatMap((message) => message.videoGenerationJob?.id ?? []);
  }

  /**
   * Org-wide AI usage aggregates — powers the trainer dashboard's "AI usage overview" widget
   * (Prompt 7 § DASHBOARD INTEGRATION). Token sums read the per-message usage columns written
   * after every provider call (the "token usage tracking foundation" of Prompt 7 § AI SECURITY);
   * they are null on user messages and on assistant rows whose provider call failed, which
   * Prisma's `_sum` skips natively.
   */
  async getUsageOverview() {
    const [totalConversations, totalMessages, tokenSums, distinctUsers] = await Promise.all([
      this.db.aiConversation.count(),
      this.db.aiMessage.count(),
      this.db.aiMessage.aggregate({ _sum: { inputTokens: true, outputTokens: true } }),
      this.db.aiConversation.findMany({ distinct: ['userId'], select: { userId: true } }),
    ]);
    return {
      totalConversations,
      totalMessages,
      totalInputTokens: tokenSums._sum.inputTokens ?? 0,
      totalOutputTokens: tokenSums._sum.outputTokens ?? 0,
      activeUsers: distinctUsers.length,
    };
  }

  touchConversation(id: string) {
    return this.db.aiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  deleteAllForUser(userId: string) {
    return this.db.aiConversation.deleteMany({ where: { userId } });
  }

  deleteConversation(id: string) {
    return this.db.aiConversation.delete({ where: { id } });
  }

  /**
   * Self-contained copy of `LessonsRepository#isAccessibleToUser` (Prompt 5 precedent, also
   * replicated by the resources module) — keep in sync if that rule ever changes. Trainers/
   * Super Admins always have access; a Trainee needs the lesson's course to be published and
   * group-assigned to them, AND the lesson's own module and the lesson itself to both be
   * published. Gates which lesson a trainee may attach as "Ask AI" context.
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
    return membership !== null;
  }
}
