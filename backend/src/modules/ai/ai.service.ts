import type { AiFeature, Role } from '@prisma/client';

import { AI_HISTORY_MESSAGES_INCLUDED, MAX_AI_CONVERSATION_TITLE_LENGTH } from '@/constants/ai';
import { videoGenerationService } from '@/modules/video-generation/video-generation.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { redactSensitiveText } from '@/utils/pii-redaction.util';

import { aiProvider } from './active-provider';
import type { ChatRequestDto, CreateTraineeVideoDto } from './ai.dto';
import { AiRepository } from './ai.repository';
import { buildLearningScopeContext, buildLessonContext } from './context-builder';
import { promptManager } from './prompt-manager';
import type { AiProvider } from './providers/ai-provider.interface';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the ai module — the "Conversation Manager" that ties the Prompt Manager,
// Context Builder, and AI Provider together. Controllers call into this layer only.
export class AiService extends BaseService {
  constructor(
    protected readonly repository: AiRepository = new AiRepository(),
    private readonly provider: AiProvider = aiProvider,
  ) {
    super();
  }

  /**
   * POST /ai/chat. Starts a new conversation (optionally scoped to a lesson) or continues an
   * existing one — see Prompt 7 § LESSON CONTEXT SYSTEM for the "Ask AI from a lesson" flow.
   * A lesson's context is fetched at most once per call, whether starting or continuing.
   */
  async chat(dto: ChatRequestDto, actor: Actor) {
    let conversationId: string;
    let conversationLessonId: string | null;
    let isNewConversation = false;
    let lessonContext = null as Awaited<ReturnType<typeof buildLessonContext>>;

    if (dto.conversationId) {
      const conversation = await this.findOwnedConversation(dto.conversationId, actor.id);
      conversationId = conversation.id;
      conversationLessonId = conversation.lessonId;
      // Lesson access is re-checked on EVERY turn, not just at conversation creation — a
      // trainee may have lost access since (removed from the group, lesson/module/course
      // unpublished or deleted), and the context is rebuilt from the lesson's LIVE content, so
      // ownership of the conversation alone must not keep that content flowing. Access loss
      // silently drops the context rather than failing the chat: the conversation itself is
      // still legitimately the user's.
      if (conversationLessonId) {
        const accessible = await this.repository.isLessonAccessibleToUser(
          conversationLessonId,
          actor.id,
          actor.role,
        );
        if (!accessible) throw new ForbiddenError('You no longer have access to this lesson.');
        lessonContext = await buildLessonContext(conversationLessonId);
        if (!lessonContext) throw new NotFoundError('Lesson not found.');
      }
    } else {
      if (dto.lessonId) {
        const accessible = await this.repository.isLessonAccessibleToUser(dto.lessonId, actor.id, actor.role);
        if (!accessible) throw new ForbiddenError("You don't have permission to access this lesson.");
        lessonContext = await buildLessonContext(dto.lessonId);
        if (!lessonContext) throw new NotFoundError('Lesson not found.');
      }

      const title = (lessonContext ? `${lessonContext.lessonTitle} — AI Chat` : dto.message)
        .slice(0, MAX_AI_CONVERSATION_TITLE_LENGTH)
        .trim();

      const created = await this.repository.createConversation({
        user: { connect: { id: actor.id } },
        lesson: dto.lessonId ? { connect: { id: dto.lessonId } } : undefined,
        title: title || 'New conversation',
      });
      conversationId = created.id;
      conversationLessonId = created.lessonId;
      isNewConversation = true;
    }

    const feature: AiFeature = dto.feature ?? 'CHAT';
    const learningScopeContext = lessonContext ? null : await buildLearningScopeContext(actor.id, actor.role);
    const promptInput = {
      feature,
      explanationLevel: dto.explanationLevel,
      lessonContext,
      learningScopeContext,
      responseLanguage: dto.responseLanguage ?? 'English',
    };
    const systemPrompt = promptManager.buildSystemPrompt(promptInput);

    // Replay bounded history (see AI_HISTORY_MESSAGES_INCLUDED) as provider-shaped turns.
    const recentMessages = await this.repository.findRecentMessages(
      conversationId,
      AI_HISTORY_MESSAGES_INCLUDED,
    );
    const history = recentMessages
      .filter((message) => message.feature !== 'GENERATE_VIDEO')
      .slice()
      .reverse()
      .map((message) => ({
        role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: message.content,
      }));
    // The Messages API requires the FIRST message to be `user`. Failed provider calls persist
    // unpaired USER rows (by design — see below), so a fixed-size window can land on an
    // ASSISTANT row first; without this trim, every other turn of a long conversation would
    // 400 at the provider and surface as a 503.
    while (history[0]?.role === 'assistant') history.shift();

    await this.repository.createMessage({
      conversation: { connect: { id: conversationId } },
      role: 'USER',
      feature,
      content: dto.message,
    });

    // If the provider call throws (rate limit / not configured / connection error), the user
    // message above stays persisted on an EXISTING conversation — the trainee's input isn't
    // silently lost, and they can retry the same conversation once the AI Learning Assistant
    // is available again. A brand-NEW conversation is rolled back instead: the error response
    // carries no conversationId, so the client can never reach it, and each retry from the
    // compose box would otherwise strand another one-message orphan in the history list.
    let response;
    try {
      response = await this.provider.chat({
        systemPrompt: redactSensitiveText(systemPrompt),
        history: history.map((message) => ({ ...message, content: redactSensitiveText(message.content) })),
        userMessage: redactSensitiveText(dto.message),
      });
    } catch (error) {
      if (isNewConversation) {
        await this.repository.deleteConversation(conversationId).catch(() => undefined);
      }
      throw error;
    }

    const guardedResponse = promptManager.parseGuardedResponse(response.content, promptInput);
    if (guardedResponse.malformed) {
      logger.warn('AI tutor response failed the guarded response contract and was replaced with a refusal', {
        conversationId,
        lessonId: conversationLessonId,
        model: response.model,
      });
    }

    const assistantMessage = await this.repository.createMessage({
      conversation: { connect: { id: conversationId } },
      role: 'ASSISTANT',
      feature,
      content: guardedResponse.content,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    await this.repository.touchConversation(conversationId);

    return {
      conversationId,
      lessonId: conversationLessonId,
      message: this.toMessageView(assistantMessage),
    };
  }

  async createTraineeVideo(dto: CreateTraineeVideoDto, actor: Actor, ipAddress?: string | null) {
    if (actor.role !== 'TRAINEE') throw new ForbiddenError('Only trainees can create tutor videos.');
    let conversationId: string;
    let lessonId: string;
    let createdConversation = false;
    const customInstructions = dto.message?.trim() ?? '';
    const requestText = customInstructions || 'Create a short explanatory video for this lesson.';

    if (dto.conversationId) {
      const conversation = await this.findOwnedConversation(dto.conversationId, actor.id);
      if (!conversation.lessonId) throw new BadRequestError('Attach a lesson before creating a video.');
      conversationId = conversation.id;
      lessonId = conversation.lessonId;
    } else {
      if (!dto.lessonId) throw new BadRequestError('Attach a lesson before creating a video.');
      const accessible = await this.repository.isLessonAccessibleToUser(dto.lessonId, actor.id, actor.role);
      if (!accessible) throw new ForbiddenError("You don't have permission to access this lesson.");
      const context = await buildLessonContext(dto.lessonId);
      if (!context) throw new NotFoundError('Lesson not found.');
      const conversation = await this.repository.createConversation({
        user: { connect: { id: actor.id } },
        lesson: { connect: { id: dto.lessonId } },
        title: `${context.lessonTitle} — AI Tutor`.slice(0, MAX_AI_CONVERSATION_TITLE_LENGTH),
      });
      conversationId = conversation.id;
      lessonId = dto.lessonId;
      createdConversation = true;
    }

    const accessible = await this.repository.isLessonAccessibleToUser(lessonId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError('You no longer have access to this lesson.');

    let userMessageId: string | undefined;
    let assistantMessageId: string | undefined;
    let videoJobId: string | undefined;
    try {
      const userMessage = await this.repository.createMessage({
        conversation: { connect: { id: conversationId } },
        role: 'USER',
        feature: 'GENERATE_VIDEO',
        content: requestText,
      });
      userMessageId = userMessage.id;
      const assistantMessage = await this.repository.createMessage({
        conversation: { connect: { id: conversationId } },
        role: 'ASSISTANT',
        feature: 'GENERATE_VIDEO',
        content: 'Your lesson video is being generated.',
      });
      assistantMessageId = assistantMessage.id;
      const video = await videoGenerationService.createTraineeExplanation(
        lessonId,
        customInstructions,
        assistantMessage.id,
        actor,
        ipAddress,
      );
      videoJobId = video.id;
      await this.repository.touchConversation(conversationId);
      return {
        conversationId,
        lessonId,
        message: { ...assistantMessage, video },
      };
    } catch (error) {
      if (videoJobId) {
        await videoGenerationService.cleanupTraineeJobs([videoJobId], actor.id).catch(() => undefined);
      }
      if (createdConversation)
        await this.repository.deleteConversation(conversationId).catch(() => undefined);
      else {
        const messageIds = [userMessageId, assistantMessageId].filter((value): value is string =>
          Boolean(value),
        );
        if (messageIds.length) await this.repository.deleteMessages(messageIds).catch(() => undefined);
      }
      throw error;
    }
  }

  getTraineeVideo(jobId: string, actor: Actor) {
    return videoGenerationService.getTraineeExplanation(jobId, actor);
  }

  previewTraineeVideo(jobId: string, actor: Actor) {
    return videoGenerationService.previewTraineeExplanation(jobId, actor);
  }

  retryTraineeVideo(jobId: string, actor: Actor) {
    return videoGenerationService.retryTraineeExplanation(jobId, actor);
  }

  async list(userId: string, filters: { lessonId?: string }, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const { items, total } = await this.repository.findMany(userId, filters, skip, pageSize);
    return { items, meta: { page, pageSize, total } };
  }

  async getConversation(id: string, actor: Actor) {
    const conversation = await this.repository.findConversationWithMessages(id);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    if (conversation.userId !== actor.id) {
      throw new ForbiddenError("You don't have permission to view this conversation.");
    }
    // Repository fetches most-recent-first (bounded window) — restore chronological order.
    return {
      ...conversation,
      messages: conversation.messages
        .slice()
        .reverse()
        .map((message) => this.toMessageView(message)),
    };
  }

  async deleteAllHistory(userId: string): Promise<void> {
    const jobIds = await this.repository.findTraineeVideoJobIdsForUser(userId);
    await videoGenerationService.cleanupTraineeJobs(jobIds, userId);
    await this.repository.deleteAllForUser(userId);
  }

  /** Org-wide usage aggregates — role-gating lives at the route layer (Trainer/Super-Admin). */
  getUsageOverview() {
    return this.repository.getUsageOverview();
  }

  async deleteConversation(id: string, actor: Actor): Promise<void> {
    const conversation = await this.findOwnedConversation(id, actor.id);
    const jobIds = await this.repository.findTraineeVideoJobIdsForConversation(conversation.id, actor.id);
    await videoGenerationService.cleanupTraineeJobs(jobIds, actor.id);
    await this.repository.deleteConversation(conversation.id);
  }

  private toMessageView<T extends object>(message: T) {
    const { videoGenerationJob, ...rest } = message as T & { videoGenerationJob?: unknown };
    return {
      ...rest,
      ...(videoGenerationJob
        ? { video: videoGenerationService.toTraineeView(videoGenerationJob as never) }
        : {}),
    };
  }

  private async findOwnedConversation(id: string, userId: string) {
    if (!id) throw new BadRequestError('conversationId is required.');
    const conversation = await this.repository.findConversationById(id);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    if (conversation.userId !== userId) {
      throw new ForbiddenError("You don't have permission to access this conversation.");
    }
    return conversation;
  }
}

/** Module-level singleton, mirroring `notificationsService` (Prompt 6 precedent). */
export const aiService = new AiService();
