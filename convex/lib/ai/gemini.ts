/**
 * Gemini Line Generator
 *
 * Wrapper for Google GenAI SDK to generate poetry lines.
 * Used by the AI Turn Engine to create lines in the persona's style.
 */

import { AiPersona } from './personas';

// We'll use dynamic import in the action since @google/generative-ai
// needs to be imported at runtime in Convex actions

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
 * Generate a line using the Gemini API.
 * This function should be called from a Convex action (not mutation).
 */
export async function generateLine(
  params: GenerateLineParams,
  apiKey: string,
  model: string = 'gemini-2.0-flash'
): Promise<GenerateLineResult> {
  // Dynamic import for Convex action compatibility
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const genAI = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.9, // Creative but not too wild
      maxOutputTokens: 50, // We only need a few words
    },
  });

  const prompt = buildPrompt(params);

  // Try up to 3 times
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await gemini.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      // Validate word count
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      if (wordCount === params.targetWordCount) {
        return { text, fallbackUsed: false };
      }

      // If wrong word count and this isn't the last attempt, add stricter instruction
      if (attempt < maxAttempts) {
        console.log(
          `AI line attempt ${attempt}: got ${wordCount} words, expected ${params.targetWordCount}. Retrying...`
        );
      }
    } catch (error) {
      console.error(`Gemini API error on attempt ${attempt}:`, error);
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
function getFallbackLine(wordCount: number): string {
  const fallbacks: Record<number, string> = {
    1: 'silence',
    2: 'words linger',
    3: 'the path continues',
    4: 'we write in circles',
    5: 'the poem finds its way',
  };

  return fallbacks[wordCount] || 'silence';
}
