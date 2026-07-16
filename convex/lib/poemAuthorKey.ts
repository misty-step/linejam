import type { Id } from '../_generated/dataModel';

/**
 * Build deterministic, poem-scoped keys for visual author grouping.
 *
 * The key is derived from the poem scope and the author's first appearance,
 * never from a durable user identifier. It is stable for a poem while making
 * the same author unmatchable across poems.
 */
export function buildPoemAuthorKeys(
  poemId: Id<'poems'>,
  authorIds: readonly Id<'users'>[]
): Map<Id<'users'>, string> {
  const scope = scopeToken(String(poemId));
  const keys = new Map<Id<'users'>, string>();
  for (const [index, authorId] of authorIds.entries()) {
    keys.set(authorId, `author-${scope}-${index}`);
  }
  return keys;
}

function scopeToken(value: string): string {
  let first = 2166136261;
  let second = 5381;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    first ^= code;
    first = Math.imul(first, 16777619);
    second = Math.imul(second ^ code, 33);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}
