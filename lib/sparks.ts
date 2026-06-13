/**
 * Sparks: tiny, ignorable nudges that give a blank line somewhere to push off
 * from. They are inspiration, never a rule — the word count stays the only
 * constraint. A spark is chosen deterministically from the poem and round so a
 * player who re-opens the writing screen sees the same whisper, never a
 * slot-machine reroll.
 */

export const SPARKS: readonly string[] = [
  'something that glows',
  'a sound no one else heard',
  'name a color',
  'a small betrayal',
  'what the weather is doing',
  'an animal, suddenly',
  'a thing you can hold',
  'somewhere far from here',
  'a memory that won’t sit still',
  'the opposite of the last line',
  'a question, unanswered',
  'something warm',
  'a name said out loud',
  'what happens next',
  'a texture underfoot',
  'a tiny act of mischief',
  'the moment before',
  'something just out of reach',
  'a promise, or a lie',
  'where the light falls',
  'a taste you can’t place',
  'someone leaving',
  'a number that means something',
  'the quietest thing in the room',
] as const;

/**
 * Stable 32-bit FNV-1a hash. Pure, dependency-free, and identical across the
 * client and any future server use.
 */
function hashString(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic spark for a given poem + round. Same inputs → same spark.
 * Returns undefined when there is no corpus (defensive; the corpus is non-empty).
 */
export function getSpark(
  poemId: string,
  roundIndex: number
): string | undefined {
  if (SPARKS.length === 0) return undefined;
  const index = hashString(`${poemId}:${roundIndex}`) % SPARKS.length;
  return SPARKS[index];
}
