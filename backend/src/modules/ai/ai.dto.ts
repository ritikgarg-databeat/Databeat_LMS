import type { AiExplanationLevel, AiFeature } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the ai module.

export interface ChatRequestDto {
  /** Omit to start a new conversation; provide to continue an existing one. */
  conversationId?: string;
  /** Only read when starting a NEW conversation — see ai.service.ts#chat. */
  lessonId?: string;
  message: string;
  feature?: AiFeature;
  explanationLevel?: AiExplanationLevel;
}

export interface ListConversationsQueryDto {
  page?: string;
  pageSize?: string;
  lessonId?: string;
}

export interface CreateTraineeVideoDto {
  conversationId?: string;
  lessonId?: string;
  message?: string;
}
