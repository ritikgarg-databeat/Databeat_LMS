export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatInput {
  systemPrompt: string;
  history: AiChatMessage[];
  userMessage: string;
}

export interface AiChatOutput {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Swappable AI-vendor seam (Prompt 7 § ARCHITECTURE — "Frontend → Backend AI Service →
 * AI Provider → Response"). Every other file in this module (ai.service.ts, prompt-manager,
 * context-builder) depends on this interface only, never on a concrete provider or its SDK
 * types — adding a second vendor later means writing one new class in this `providers/`
 * folder and flipping an env var, not touching any call site.
 */
export interface AiProvider {
  chat(input: AiChatInput): Promise<AiChatOutput>;
}
