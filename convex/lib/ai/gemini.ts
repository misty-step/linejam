/**
 * Gemini Line Generator (via OpenRouter)
 *
 * Wrapper for OpenRouter API to generate poetry lines using Gemini models.
 * Used by the AI Turn Engine to create lines in the persona's style.
 */

import { AiPersona } from './personas';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

export interface GenerateLineParams {
  persona: AiPersona;
  previousLineText?: string;
  targetWordCount: number;
}

export interface GenerateLineResult {
  text: string;
  fallbackUsed: boolean;
}

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
 * Generate a line using OpenRouter API (Gemini model).
 * This function should be called from a Convex action (not mutation).
 */
export async function generateLine(
  params: GenerateLineParams,
  apiKey: string,
  model: string = DEFAULT_MODEL
): Promise<GenerateLineResult> {
  const prompt = buildPrompt(params);

  // Try up to 3 times
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://linejam.app',
          'X-Title': 'Linejam',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
          max_tokens: 100,
        }),
      });

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
      console.log(
        `AI response: model=${data.model}, wordCount=${wordCount}, target=${params.targetWordCount}, finishReason=${finishReason}, contentLength=${text.length}`
      );

      if (wordCount === params.targetWordCount) {
        return { text, fallbackUsed: false };
      }

      // If wrong word count and this isn't the last attempt, retry
      if (attempt < maxAttempts) {
        console.log(
          `AI line attempt ${attempt}: got ${wordCount} words, expected ${params.targetWordCount}. Retrying...`
        );
      }
    } catch (error) {
      console.error(`OpenRouter API error on attempt ${attempt}:`, error);
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

/**
 * Fallback lines when API fails or returns wrong word count.
 * These are deterministic and always match the target word count.
 */
export function getFallbackLine(wordCount: number): string {
  const fallbacks: Record<number, string> = {
    1: 'silence',
    2: 'words linger',
    3: 'the path continues',
    4: 'we write in circles',
    5: 'the poem finds its way',
  };

  return fallbacks[wordCount] || 'silence';
}
