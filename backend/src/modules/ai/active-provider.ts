import { env } from '@/config/env';

import type { AiProvider } from './providers/ai-provider.interface';
import { AnthropicAiProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * The one place the active AI vendor is chosen — `AI_PROVIDER` (env.ts, default `openai`) picks
 * between the two `AiProvider` implementations in `./providers/`. Kept in its own file (rather
 * than inline in `index.ts`) so `ai.service.ts` can import this singleton without creating a
 * circular import through `index.ts` (which itself re-exports `AiService`/`aiService` from
 * `ai.service.ts`). Every consumer — ai.service.ts, dashboard-insights.service.ts, the
 * lesson-quiz module — imports `aiProvider` from here (directly or via `index.ts`'s re-export)
 * and never a concrete provider class, so switching vendors again later is exactly this one
 * ternary, not a call-site change. Same graceful-degradation contract either way: chat() throws
 * ServiceUnavailableError (503) when the active provider's API key is unset.
 */
export const aiProvider: AiProvider =
  env.AI_PROVIDER === 'anthropic' ? new AnthropicAiProvider() : new OpenAiProvider();
