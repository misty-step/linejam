import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('public artifact privacy wiring', () => {
  it.each([
    ['app/poem/[id]/metadata.ts', 'getPublicPoemPreview'],
    ['app/poem/[id]/opengraph-image-handler.tsx', 'getPublicPoemPreview'],
    ['app/poem/[id]/PoemDetail.tsx', 'getPublicPoemFull'],
    ['app/recap/[code]/RecapPage.tsx', 'getPublicSessionRecap'],
    ['app/recap/[code]/metadata.ts', 'getPublicSessionRecap'],
    ['app/recap/[code]/opengraph-image.tsx', 'getPublicSessionRecap'],
  ])('%s reads through %s', (path, publicQuery) => {
    expect(read(path)).toContain(publicQuery);
  });

  it('keeps public card GETs separate from participant-only local saves', () => {
    const route = read('app/poem/[id]/card/handler.ts');
    const publicQuery = route.slice(
      route.indexOf('fetchPublicPoem: (poemId)'),
      route.indexOf('fetchPoemDetail: (poemId')
    );
    const participantQuery = route.slice(
      route.indexOf('fetchPoemDetail: (poemId'),
      route.indexOf('getConvexToken: async')
    );
    const publicGet = route.slice(
      route.indexOf('async function get'),
      route.indexOf('async function post')
    );
    const participantPost = route.slice(route.indexOf('async function post'));

    expect(publicQuery).toContain('getPublicPoemFull');
    expect(publicQuery).not.toContain('getPoemDetail');
    expect(participantQuery).toContain('getPoemDetail');
    expect(publicGet).toMatch(/dependencies\s*\.fetchPublicPoem/);
    expect(publicGet).not.toMatch(/dependencies\s*\.fetchPoemDetail/);
    expect(participantPost).toMatch(/dependencies\s*\.fetchPoemDetail/);
  });
});
