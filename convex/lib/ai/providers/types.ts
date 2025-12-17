/**
 * LLM Provider Types
 *
 * Abstractions for language model providers. Enables swapping models/providers
 * without changing calling code.
 */

import type { AiPersona } from '../personas';

/**
 * Parameters for generating a poetry line.
 */
export interface GenerateLineParams {
  persona: AiPersona;
  previousLineText?: string;
  targetWordCount: number;
}

/**
 * Result from line generation.
 */
export interface GenerateLineResult {
  text: string;
  fallbackUsed: boolean;
}

/**
 * Configuration for LLM provider.
 */
export interface LLMConfig {
  /** Provider type - extensible for future providers */
  provider: 'openrouter';
  /** Model identifier (e.g., 'google/gemini-2.5-flash') */
  model: string;
  /** API key for the provider */
  apiKey: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Maximum retry attempts for word count validation (default: 3) */
  maxRetries?: number;
}

/**
 * LLM Provider interface.
 * Implement this to add new providers (Anthropic, OpenAI, etc.)
 */
export interface LLMProvider {
  generateLine(params: GenerateLineParams): Promise<GenerateLineResult>;
}
