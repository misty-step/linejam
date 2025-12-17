/**
 * Word Count Guard
 *
 * Utility to normalize and validate AI-generated text to match
 * the exact word count requirement.
 */

import { countWords } from '../wordCount';

/**
 * Clean up AI output: remove quotes, extra whitespace, etc.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validate that text has exactly the target word count.
 */
export function validateWordCount(
  text: string,
  targetWordCount: number
): boolean {
  const actual = countWords(text);
  return actual === targetWordCount;
}

/**
 * Attempt to fix text that doesn't match target word count.
 * This is a best-effort fix - may not always succeed.
 *
 * Returns null if unable to fix.
 */
export function attemptFix(
  text: string,
  targetWordCount: number
): string | null {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  const actual = words.length;

  if (actual === targetWordCount) {
    return normalized;
  }

  // If too many words, truncate (preserving poetic sense is hard, but try)
  if (actual > targetWordCount) {
    return words.slice(0, targetWordCount).join(' ');
  }

  // If too few words, we can't reasonably add words
  // Return null to signal fallback needed
  return null;
}
