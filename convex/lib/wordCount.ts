export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Final word of a line, stripped of trailing punctuation. Used as the rhyme target. */
export function getLastWord(text: string): string | undefined {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  if (!last) return undefined;
  const cleaned = last.replace(/[^\p{L}\p{N}'-]+$/u, '');
  return cleaned || last;
}
