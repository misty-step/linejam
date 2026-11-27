// Game rules shared verbatim by the Worker, the browser client, the CLI and
// the MCP server. One definition; no face gets its own copy of a rule.

export const ROUND_WORDS = [1, 2, 3, 4, 5, 4, 3, 2, 1] as const;
export const ROUNDS = ROUND_WORDS.length;
export const MAX_LINE_CHARS = 500;
export const ROOM_CAPACITY = 8;
export const MIN_PLAYERS = 2;
export const MAX_PEN_NAME_CHARS = 40;

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export const EMBLEMS = ['loom', 'vesper', 'prism', 'clover', 'orrery', 'arch', 'pinwheel', 'lattice'] as const;
export type Emblem = (typeof EMBLEMS)[number];

export function isEmblem(value: unknown): value is Emblem {
  return typeof value === 'string' && (EMBLEMS as readonly string[]).includes(value);
}

export function emblemName(emblem: Emblem): string {
  return emblem[0]!.toUpperCase() + emblem.slice(1);
}

/** Leading/trailing whitespace is ignored; tabs and newlines collapse to single spaces. */
export function normalizeLine(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean).join(' ');
}

/** A word is a nonempty whitespace-separated group; attached punctuation stays part of it. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Typed codes are uppercased and stripped of separators. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isRoomCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export function normalizePenName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export type LineProblem = { code: 'line_too_long'; message: string } | { code: 'wrong_word_count'; message: string };

/** The single line-acceptance rule. `round` is 0-based. */
export function checkLine(text: string, round: number): LineProblem | null {
  const target = ROUND_WORDS[round]!;
  const normalized = normalizeLine(text);
  if (normalized.length > MAX_LINE_CHARS) {
    return { code: 'line_too_long', message: `Use ${MAX_LINE_CHARS} characters or fewer` };
  }
  if (countWords(normalized) !== target) {
    return {
      code: 'wrong_word_count',
      message: `Use ${target} ${target === 1 ? 'word' : 'words'}`,
    };
  }
  return null;
}

/**
 * Pass-the-poem assignment: in round `round`, poem `poem` is written by the
 * writer at seat `(poem + round) % writers`. Every round is a permutation, a
 * poem never gets two consecutive lines from one writer, and (with 2–8 writers
 * over 9 rounds) every writer writes on every poem.
 */
export function writerSeat(poem: number, round: number, writers: number): number {
  return (poem + round) % writers;
}

/** The poem a seat writes on in a round (inverse of `writerSeat`). */
export function poemForSeat(seat: number, round: number, writers: number): number {
  return (((seat - round) % writers) + writers) % writers;
}

/** The reader of a poem is the seat after the one that started it. */
export function readerSeat(poem: number, writers: number): number {
  return (poem + 1) % writers;
}
