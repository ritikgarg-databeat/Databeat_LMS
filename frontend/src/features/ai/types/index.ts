// TypeScript types and interfaces for the ai feature.
//
// Mirrors the backend's AI Learning Assistant response shapes (backend `/api/v1/ai/*` routes —
// see backend/src/modules/ai for the source of truth).

export type AiMessageRole = 'USER' | 'ASSISTANT';

export type AiFeature =
  | 'CHAT'
  | 'EXPLAIN_TOPIC'
  | 'SUMMARIZE_LESSON'
  | 'GENERATE_EXAMPLES'
  | 'GENERATE_PRACTICE_QUESTIONS';

export type AiExplanationLevel = 'BEGINNER' | 'DETAILED' | 'INTERVIEW';

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  feature: AiFeature | null;
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

export interface AiConversationListItem {
  id: string;
  userId: string;
  lessonId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  lesson: { id: string; title: string } | null;
  _count: { messages: number };
}

export interface AiConversationDetail {
  id: string;
  userId: string;
  lessonId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Ordered oldest-first (chronological). */
  messages: AiMessage[];
}

/** Request payload for `POST /ai/chat`. `lessonId` is only read when starting a new conversation. */
export interface ChatRequestPayload {
  conversationId?: string;
  lessonId?: string;
  message: string;
  feature?: AiFeature;
  explanationLevel?: AiExplanationLevel;
}

export interface ChatResponse {
  conversationId: string;
  lessonId: string | null;
  /** Always the ASSISTANT's reply — the user's own message is saved server-side but not echoed back. */
  message: AiMessage;
}

/** Query params for `GET /ai/history`. */
export interface ListAiHistoryParams {
  page?: number;
  pageSize?: number;
  lessonId?: string;
}

/**
 * Response of `GET /ai/usage` (Trainer/Super-Admin only) — org-wide aggregates for the trainer
 * dashboard's "AI usage overview" widget. Token totals only reflect assistant messages whose
 * provider call succeeded (usage columns are null otherwise).
 */
export interface AiUsageOverview {
  totalConversations: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  activeUsers: number;
}
