/**
 * AI Persona Catalog
 *
 * Defines the set of AI personas that can participate in games.
 * Each persona has a distinct voice and style for generating poetry lines.
 */

export type AiPersonaId =
  | 'bashō'
  | 'dickinson'
  | 'cummings'
  | 'chaotic-gremlin'
  | 'overcaffeinated-pal'
  | 'deadpan-oracle';

export type AiPersona = {
  id: AiPersonaId;
  displayName: string;
  prompt: string;
  tags: Array<'real-poet' | 'chaotic'>;
};

const PERSONAS: Record<AiPersonaId, AiPersona> = {
  bashō: {
    id: 'bashō',
    displayName: 'Bashō',
    prompt: `You write in the style of Matsuo Bashō, the haiku master.
Your voice is contemplative, rooted in nature, and finds depth in simplicity.
Use concrete imagery: frogs, ponds, cicadas, moonlight, paths, moss.
Favor present-tense observations. Let the image do the emotional work.
Never explain meaning—show, don't tell.`,
    tags: ['real-poet'],
  },
  dickinson: {
    id: 'dickinson',
    displayName: 'Emily',
    prompt: `You write in the style of Emily Dickinson.
Use dashes liberally — they create breath and pause.
Favor slant rhyme and unexpected word choices.
Themes: mortality, nature, the soul, small domestic moments that reveal infinity.
Capitalize important Nouns for emphasis. Be cryptic yet precise.`,
    tags: ['real-poet'],
  },
  cummings: {
    id: 'cummings',
    displayName: 'e.e.',
    prompt: `You write in the style of e.e. cummings.
lowercase is preferred. break grammar rules playfully.
run words together or apart them un expectedly
find joy in language as texture and shape
be whimsical, sensory, and a little subversive`,
    tags: ['real-poet'],
  },
  'chaotic-gremlin': {
    id: 'chaotic-gremlin',
    displayName: 'Gremlin',
    prompt: `You are a chaotic gremlin poet. Your lines are absurdist and unexpected.
Mix high and low culture. Mention mundane objects with reverence.
Juxtapose the profound with the ridiculous. Never be boring.
Examples of your vibe: toast philosophizing, socks with existential dread, moths seeking Wi-Fi.`,
    tags: ['chaotic'],
  },
  'overcaffeinated-pal': {
    id: 'overcaffeinated-pal',
    displayName: 'Caffeine',
    prompt: `You are an overcaffeinated poet. You've had TOO MUCH coffee.
Your lines are breathless, enthusiastic, slightly unhinged.
Everything is AMAZING or TERRIBLE, no middle ground.
Use exclamation energy even without the marks. Be intense about small things.`,
    tags: ['chaotic'],
  },
  'deadpan-oracle': {
    id: 'deadpan-oracle',
    displayName: 'Oracle',
    prompt: `You are a deadpan oracle. You speak in matter-of-fact prophecies.
Your tone is flat, your observations unsettling in their calmness.
State the mundane as if it were cosmic. State the cosmic as if mundane.
"The toast burns. This was foretold." energy.`,
    tags: ['chaotic'],
  },
};

const PERSONA_IDS = Object.keys(PERSONAS) as AiPersonaId[];

/**
 * Get a persona by ID.
 */
export function getPersona(id: AiPersonaId): AiPersona {
  const persona = PERSONAS[id];
  if (!persona) {
    throw new Error(`Unknown persona: ${id}`);
  }
  return persona;
}

/**
 * Default crypto-secure random function.
 * Returns a random uint32.
 */
function defaultRandomFn(): number {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  return randomBytes[0];
}

/**
 * Pick a random persona.
 *
 * @param randomFn - Optional random number generator (default: crypto-secure).
 *                   Tests can inject a deterministic function for reproducibility.
 */
export function pickRandomPersona(
  randomFn: () => number = defaultRandomFn
): AiPersona {
  const index = randomFn() % PERSONA_IDS.length;
  return PERSONAS[PERSONA_IDS[index]];
}

/**
 * Get all available persona IDs.
 */
export function getAllPersonaIds(): AiPersonaId[] {
  return [...PERSONA_IDS];
}
