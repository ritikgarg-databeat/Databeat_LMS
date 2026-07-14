export { default as aiRoutes } from './ai.routes';
export { AiController } from './ai.controller';
export { AiService, aiService } from './ai.service';
export type { ChatRequestDto, ListConversationsQueryDto } from './ai.dto';
export type { AiProvider, AiChatInput, AiChatOutput, AiChatMessage } from './providers/ai-provider.interface';
// Published for one-off, non-conversational calls (e.g. analytics AI-insights generation, the
// lesson-quiz module) that need an arbitrary system prompt and no persisted
// AiConversation/AiMessage history — bypasses AiService's conversation-management layer
// entirely. See ./active-provider.ts for how AI_PROVIDER picks the concrete implementation.
export { aiProvider } from './active-provider';
