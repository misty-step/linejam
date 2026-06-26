/**
 * Deterministic Fallback Lines (combinatorial)
 *
 * Used when LLM generation fails, returns the wrong word count, or the bot runs
 * in deterministic/budget-exhausted mode. Lines must ALWAYS match the target
 * word count exactly (so commitAssignedLine never re-substitutes).
 *
 * Rather than a fixed list, lines are *composed* from small word pools via
 * per-count grammatical templates, so there are hundreds–thousands of distinct
 * outputs per word count (backlog 028 — fallbacks should rarely repeat across a
 * 3-bot, 9-round game). A deterministic seed (`<poemId>:<round>`) picks the
 * template and fills each slot; the same seed always yields the same line.
 * Every template produces EXACTLY its word count (literal connective tokens +
 * single-token pool words; verified by fallbacks.test.ts across the bank).
 */

// Single-token pools (no spaces; hyphens are fine — one whitespace token).
const NOUN = [
  'moth',
  'kettle',
  'dusk',
  'ember',
  'frost',
  'river',
  'bone',
  'moon',
  'shadow',
  'lantern',
  'sparrow',
  'thicket',
  'tide',
  'cinder',
  'marrow',
  'orchard',
  'glacier',
  'comet',
  'attic',
  'window',
  'harbor',
  'meadow',
  'antler',
  'cathedral',
  'static',
  'mirror',
  'thread',
  'hollow',
  'silence',
  'rain',
  'snowfall',
  'driftwood',
  'lichen',
  'whisper',
  'doorway',
];
const VERB = [
  'lingers',
  'gathers',
  'forgets',
  'settles',
  'drifts',
  'waits',
  'hums',
  'fades',
  'trembles',
  'unravels',
  'listens',
  'kindles',
  'dissolves',
  'wanders',
  'remembers',
  'flickers',
  'deepens',
  'softens',
  'returns',
  'hesitates',
  'rusts',
  'breathes',
  'leans',
  'spills',
  'hardens',
];
const ADJ = [
  'silent',
  'hollow',
  'pale',
  'distant',
  'restless',
  'golden',
  'brittle',
  'quiet',
  'sudden',
  'weary',
  'luminous',
  'crooked',
  'tender',
  'frozen',
  'half-lit',
  'patient',
  'feral',
  'velvet',
  'ashen',
  'reluctant',
  'wide',
  'electric',
  'forgotten',
  'salt-stained',
];

const POOLS: Record<string, readonly string[]> = { NOUN, VERB, ADJ };

// Templates per word count. Each token is a literal connective or a pool key;
// the rendered token count equals the key (asserted in tests).
const TEMPLATES: Record<number, readonly (readonly string[])[]> = {
  1: [['NOUN']],
  2: [
    ['ADJ', 'NOUN'],
    ['NOUN', 'VERB'],
  ],
  3: [
    ['the', 'NOUN', 'VERB'],
    ['ADJ', 'NOUN', 'VERB'],
  ],
  4: [
    ['the', 'ADJ', 'NOUN', 'VERB'],
    ['NOUN', 'VERB', 'the', 'NOUN'],
  ],
  5: [
    ['the', 'NOUN', 'VERB', 'the', 'NOUN'],
    ['ADJ', 'NOUN', 'VERB', 'into', 'NOUN'],
  ],
};

/**
 * The deterministic key that makes a poem-cell's fallback line stable and
 * distinct. One place to change the scheme (e.g. to fold in gameId later) so the
 * six call sites can't drift.
 */
export function fallbackSeed(poemId: string, round: number): string {
  return `${poemId}:${round}`;
}

/** FNV-1a — small, stable, dependency-free. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Get a deterministic fallback line for a given word count. With a `seed`, picks
 * a template + fills each slot from its pool (stable for the same seed); without
 * a seed, uses a fixed seed so the output is stable. Unexpected counts fall back
 * to the 5-word templates (defensive). Always exactly `wordCount` words.
 */
export function getFallbackLine(wordCount: number, seed?: string): string {
  const templates = TEMPLATES[wordCount] ?? TEMPLATES[5];
  const h = hashSeed(seed ?? 'default');
  const template = templates[h % templates.length];

  return template
    .map((token, i) => {
      const pool = POOLS[token];
      if (!pool) return token; // literal connective ("the", "into", …)
      // Offset the hash per slot so two slots from the same pool differ.
      return pool[hashSeed(`${seed ?? 'default'}#${i}`) % pool.length];
    })
    .join(' ');
}
