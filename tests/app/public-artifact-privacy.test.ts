import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('public artifact privacy wiring', () => {
  it.each([
    ['app/poem/[id]/metadata.ts', 'getPublicPoemPreview'],
    ['app/poem/[id]/opengraph-image.tsx', 'getPublicPoemPreview'],
    ['app/poem/[id]/PoemDetail.tsx', 'getPublicPoemFull'],
    ['app/recap/[code]/page.tsx', 'getPublicSessionRecap'],
    ['app/recap/[code]/metadata.ts', 'getPublicSessionRecap'],
    ['app/recap/[code]/opengraph-image.tsx', 'getPublicSessionRecap'],
  ])('%s reads through %s', (path, publicQuery) => {
    expect(read(path)).toContain(publicQuery);
  });

  it('keeps public card GETs separate from participant-only local saves', () => {
    const route = read('app/poem/[id]/card/route.ts');
    const publicGet = route.slice(
      route.indexOf('export async function GET'),
      route.indexOf('export async function POST')
    );
    const participantPost = route.slice(
      route.indexOf('export async function POST')
    );

    expect(publicGet).toContain('getPublicPoemFull');
    expect(publicGet).not.toContain('getPoemDetail');
    expect(participantPost).toContain('getPoemDetail');
  });
});
