/**
 * Deterministic Fallback Lines
 *
 * Used when LLM generation fails or returns wrong word count.
 * These are poetic, on-theme, and always match the target word count.
 */

/**
 * Get a deterministic fallback line for a given word count.
 * Returns 5-word fallback for unexpected counts (defensive).
 */
export function getFallbackLine(wordCount: number): string {
  const fallbacks: Record<number, string> = {
    1: 'silence',
    2: 'words linger',
    3: 'the path continues',
    4: 'we write in circles',
    5: 'the poem finds its way',
  };

  return fallbacks[wordCount] || fallbacks[5];
}
