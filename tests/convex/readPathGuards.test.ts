import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function exportedFunctionBody(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  if (start === -1) throw new Error(`Missing export ${exportName}`);

  const nextExport = source.indexOf('\nexport const ', start + 1);
  return nextExport === -1
    ? source.slice(start)
    : source.slice(start, nextExport);
}

describe('Convex launch read path guards', () => {
  const archiveSource = readFileSync('convex/archive.ts', 'utf8');
  const poemSource = readFileSync('convex/poems.ts', 'utf8');
  const schemaSource = readFileSync('convex/schema.ts', 'utf8');

  it('keeps getRecentPublicPoems on indexed reads instead of query filters', () => {
    const body = exportedFunctionBody(archiveSource, 'getRecentPublicPoems');

    expect(body).not.toContain('.filter((q)');
    expect(body).toContain(".withIndex('by_public_created'");
    expect(body).toContain(".eq('publicShareEnabled', true)");
    expect(body).toContain(".withIndex('by_poem_index'");
    expect(schemaSource).toContain(".index('by_public_created'");
  });

  it('keeps user history reads explicitly windowed', () => {
    const archiveBody = exportedFunctionBody(archiveSource, 'getArchiveData');
    const myPoemsBody = exportedFunctionBody(poemSource, 'getMyPoems');

    expect(archiveBody).toContain('limit: v.optional(v.number())');
    expect(archiveBody).toContain('.take(');
    expect(myPoemsBody).toContain('limit: v.optional(v.number())');
    expect(myPoemsBody).toContain('.take(');
    expect(schemaSource).toContain(".index('by_author_created'");
  });
});
