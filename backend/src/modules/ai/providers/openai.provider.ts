import OpenAI, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';

import { env } from '@/config/env';
import { AI_MAX_RESPONSE_TOKENS } from '@/constants/ai';
import { ServiceUnavailableError, TooManyRequestsError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { AiChatInput, AiChatOutput, AiProvider } from './ai-provider.interface';

/**
 * OpenAI implementation of {@link AiProvider} — the Responses API (`client.responses.create`),
 * not Chat Completions: `gpt-5.3-codex` (the configured model as of this writing) rejects
 * `v1/chat/completions` outright ("This model is not supported in the v1/chat/completions
 * endpoint. Use the v1/responses endpoint instead." — confirmed via a live API call while
 * building this, not assumed). This is the ONLY file in the codebase that imports `openai`
 * directly — ai.service.ts, the prompt manager, the context builder, and the lesson-quiz module
 * all talk to the `AiProvider` interface. See `../providers/anthropic.provider.ts` for the other
 * implementation and `../active-provider.ts` for how `AI_PROVIDER` picks which one is active.
 *
 * The client is constructed lazily as `null` when `MAIN_OPENAI_API_KEY` is unset so the app
 * still boots and every other module keeps working — `chat()` fails with a clear 503 instead of
 * a 500/crash. Model id is read from `MAIN_OPENAI_MODEL` (default `gpt-5.3-codex`) so it can be
 * swapped without a code change. Uses a low `reasoning.effort` — every current call site here is
 * a short, well-specified generation task (a tutoring reply, a lesson quiz), not an open-ended
 * agentic one.
 */
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI | null;

  constructor() {
    this.client = env.MAIN_OPENAI_API_KEY ? new OpenAI({ apiKey: env.MAIN_OPENAI_API_KEY }) : null;
  }

  async chat(input: AiChatInput): Promise<AiChatOutput> {
    if (!this.client) {
      // The actionable detail (which env var to set) goes to the server log only — the client
      // message stays generic, matching the Anthropic provider's masking of configuration state.
      logger.warn('AI chat requested but no provider is configured (MAIN_OPENAI_API_KEY is unset).');
      throw new ServiceUnavailableError(
        'The AI Learning Assistant is not available yet. Please contact an administrator.',
      );
    }

    try {
      const response = await this.client.responses.create({
        model: env.MAIN_OPENAI_MODEL,
        instructions: input.systemPrompt,
        max_output_tokens: AI_MAX_RESPONSE_TOKENS,
        reasoning: { effort: 'low' },
        input: [
          ...input.history.map((message) => ({ role: message.role, content: message.content })),
          { role: 'user' as const, content: input.userMessage },
        ],
      });

      if (response.error) {
        logger.warn('OpenAI Responses API returned an error object', { error: response.error });
        throw new ServiceUnavailableError(
          'The AI Learning Assistant could not answer that request. Try rephrasing your question.',
        );
      }

      return {
        content: response.output_text,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;

      // Most-specific-first: RateLimitError/AuthenticationError/PermissionDeniedError are all
      // subclasses of APIError in this SDK too, so APIError must be checked last.
      if (error instanceof RateLimitError) {
        logger.warn('OpenAI API rate limit hit', { message: error.message });
        throw new TooManyRequestsError(
          'The AI Learning Assistant is receiving too many requests right now. Please try again shortly.',
        );
      }
      if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
        // Never surface "invalid API key" or similar internals to the client; log the real
        // cause server-side.
        logger.error('OpenAI API authentication/permission error', { message: error.message });
        throw new ServiceUnavailableError('The AI Learning Assistant is temporarily unavailable.');
      }
      if (error instanceof APIConnectionError) {
        logger.error('OpenAI API connection error', { message: error.message });
        throw new ServiceUnavailableError(
          'Could not reach the AI Learning Assistant. Please try again shortly.',
        );
      }
      if (error instanceof APIError) {
        logger.error('OpenAI API error', { status: error.status, message: error.message });
        throw new ServiceUnavailableError(
          'The AI Learning Assistant ran into a problem. Please try again shortly.',
        );
      }

      logger.error('Unexpected error calling the AI provider', { error });
      throw new ServiceUnavailableError('The AI Learning Assistant ran into an unexpected problem.');
    }
  }
}
