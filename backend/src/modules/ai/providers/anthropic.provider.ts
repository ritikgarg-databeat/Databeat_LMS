import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/config/env';
import { AI_MAX_RESPONSE_TOKENS } from '@/constants/ai';
import { ServiceUnavailableError, TooManyRequestsError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { AiChatInput, AiChatOutput, AiProvider } from './ai-provider.interface';

/**
 * Anthropic implementation of {@link AiProvider} (Claude Messages API, non-streaming). This is
 * the ONLY file in the codebase that imports `@anthropic-ai/sdk` directly — ai.service.ts,
 * the prompt manager, and the context builder all talk to the `AiProvider` interface. See
 * `./openai.provider.ts` for the other implementation and `../index.ts` for how `AI_PROVIDER`
 * picks which one is active (OpenAI by default — see env.ts).
 *
 * The client is constructed lazily as `null` when `ANTHROPIC_API_KEY` is unset so the app still
 * boots and every other module keeps working — `chat()` fails with a clear 503 instead of a
 * 500/crash. Model id is read from `AI_MODEL_ID` (default `claude-opus-4-8`) so it can be
 * swapped in production without a code change.
 */
export class AnthropicAiProvider implements AiProvider {
  private readonly client: Anthropic | null;

  constructor() {
    this.client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  }

  async chat(input: AiChatInput): Promise<AiChatOutput> {
    if (!this.client) {
      // The actionable detail (which env var to set) goes to the server log only — the client
      // message stays generic, consistent with this file's masking of auth/permission errors
      // below (any authenticated trainee can trigger this path and shouldn't learn the
      // provider vendor or configuration state from it).
      logger.warn('AI chat requested but no provider is configured (ANTHROPIC_API_KEY is unset).');
      throw new ServiceUnavailableError(
        'The AI Learning Assistant is not available yet. Please contact an administrator.',
      );
    }

    try {
      const response = await this.client.messages.create({
        model: env.AI_MODEL_ID,
        max_tokens: AI_MAX_RESPONSE_TOKENS,
        system: input.systemPrompt,
        messages: [
          ...input.history.map((message) => ({ role: message.role, content: message.content })),
          { role: 'user' as const, content: input.userMessage },
        ],
      });

      // Safety-classifier or model decline (HTTP 200, stop_reason "refusal") — check before
      // reading `content`, which may be empty (pre-output) or partial (mid-stream).
      if (response.stop_reason === 'refusal') {
        throw new ServiceUnavailableError(
          'The AI Learning Assistant could not answer that request. Try rephrasing your question.',
        );
      }

      const textBlock = response.content.find((block) => block.type === 'text');
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : '';

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;

      // Most-specific-first: RateLimitError/AuthenticationError/PermissionDeniedError/
      // APIConnectionError are all subclasses of APIError in the TS SDK, so APIError must be
      // checked last or it would swallow every other branch.
      if (error instanceof Anthropic.RateLimitError) {
        logger.warn('Anthropic API rate limit hit', { message: error.message });
        throw new TooManyRequestsError(
          'The AI Learning Assistant is receiving too many requests right now. Please try again shortly.',
        );
      }
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError
      ) {
        // Never surface "invalid API key" or similar internals to the client (Prompt 7 §
        // AI SECURITY — no sensitive information exposure); log the real cause server-side.
        logger.error('Anthropic API authentication/permission error', { message: error.message });
        throw new ServiceUnavailableError('The AI Learning Assistant is temporarily unavailable.');
      }
      if (error instanceof Anthropic.APIConnectionError) {
        logger.error('Anthropic API connection error', { message: error.message });
        throw new ServiceUnavailableError(
          'Could not reach the AI Learning Assistant. Please try again shortly.',
        );
      }
      if (error instanceof Anthropic.APIError) {
        logger.error('Anthropic API error', { status: error.status, message: error.message });
        throw new ServiceUnavailableError(
          'The AI Learning Assistant ran into a problem. Please try again shortly.',
        );
      }

      logger.error('Unexpected error calling the AI provider', { error });
      throw new ServiceUnavailableError('The AI Learning Assistant ran into an unexpected problem.');
    }
  }
}
