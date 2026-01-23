/**
 * OpenRouter Provider
 *
 * Implements LLM line generation via OpenRouter API.
 * Supports multiple models (Gemini, Claude, GPT, etc.) through a unified interface.
 */

import type {
  GenerateLineParams,
  GenerateLineResult,
  LLMConfig,
} from './types';
import { getFallbackLine } from '../fallbacks';
import { log, logError } from '../../errors';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Build the prompt for line generation.
 */
export function buildPrompt(params: GenerateLineParams): string {
  const { persona, previousLineText, targetWordCount } = params;

  let contextPart = '';
  if (previousLineText) {
    contextPart = `
The previous line in this collaborative poem was:
"${previousLineText}"

Continue the poem with your line. You may respond to, contrast with, or build upon the previous line.`;
  } else {
    contextPart = `
This is the FIRST line of a new collaborative poem. Begin with something evocative that others can build upon.`;
  }

  return `${persona.prompt}

You are contributing one line to a collaborative poem. Other poets (human and AI) are writing the other lines.

STRICT REQUIREMENTS:
- Output EXACTLY ${targetWordCount} word${targetWordCount !== 1 ? 's' : ''}.
- Output ONLY the line itself—no quotes, no explanation, no punctuation that isn't part of the line.
- Do not use line breaks.
${contextPart}

Your ${targetWordCount}-word line:`;
}

/**
 * Generate a line using OpenRouter API.
 * Includes timeout, retry logic, and fallback handling.
 */
export async function generateLine(
  params: GenerateLineParams,
  config: LLMConfig
): Promise<GenerateLineResult> {
  const prompt = buildPrompt(params);
  const maxAttempts = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://linejam.app',
          'X-Title': 'Linejam',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
          max_tokens: 100,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      const finishReason = data.choices?.[0]?.finish_reason;

      // Validate word count
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Log response details for debugging
      log.info('AI response received', {
        model: data.model,
        wordCount,
        targetWordCount: params.targetWordCount,
        finishReason,
        contentLength: text.length,
      });

      if (wordCount === params.targetWordCount) {
        return { text, fallbackUsed: false };
      }

      // If wrong word count and this isn't the last attempt, retry
      if (attempt < maxAttempts) {
        log.warn('AI line word count mismatch, retrying', {
          attempt,
          maxAttempts,
          wordCount,
          targetWordCount: params.targetWordCount,
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        log.error('OpenRouter API timeout', {
          attempt,
          maxAttempts,
          timeoutMs,
        });
      } else {
        logError('OpenRouter API error', error, {
          attempt,
          maxAttempts,
          model: config.model,
        });
      }

      if (attempt === maxAttempts) {
        // Fall through to fallback
      }
    }
  }

  // Fallback: deterministic word-bank line
  return {
    text: getFallbackLine(params.targetWordCount),
    fallbackUsed: true,
  };
}
