/**
 * LLM Public Interface
 *
 * Re-exports from provider implementations. Import from here for a stable API.
 * Current implementation: OpenRouter (supports Gemini, Claude, GPT, etc.)
 */

export { generateLine, buildPrompt } from './providers/openrouter';
export { getFallbackLine } from './fallbacks';
export type {
  GenerateLineParams,
  GenerateLineResult,
  LLMConfig,
  LLMProvider,
} from './providers/types';
