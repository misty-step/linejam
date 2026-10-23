import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// #604: braces@3.0.3 (GHSA-vfj7-8cjw-p6xm) has no fixed release, so pnpm
// overrides route its only dependents to stand-ins in tools/braces-free.
// Resolve each stand-in exactly as its dependent does at runtime.
function requireFrom(packageDir: string) {
  return createRequire(join(realpathSync(packageDir), 'package.json'));
}

const semanticRelease = requireFrom('node_modules/semantic-release');
const commitAnalyzerDir = join(
  realpathSync('node_modules/semantic-release'),
  '..',
  '@semantic-release/commit-analyzer'
);
const nextPluginDir = join(
  realpathSync('node_modules/eslint-config-next'),
  '..',
  '@next/eslint-plugin-next'
);

// Option shapes the fast-glob stand-in must reject (plus the one it accepts).
type UnsupportedGlobOptions =
  | {
      readonly onlyDirectories?: boolean | number | string;
      readonly dot?: boolean;
    }
  | readonly string[]
  | null;

type Micromatch = ((
  list: string[],
  patterns: string | string[]
) => string[]) & {
  isMatch: (str: string, patterns: string | string[]) => boolean;
};

describe('braces-free dependency stand-ins', () => {
  it('keeps braces, micromatch and fast-glob out of the lockfile', () => {
    const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
    expect(lockfile).not.toMatch(/^ {2}'?braces@/m);
    expect(lockfile).not.toMatch(/^ {2}'?micromatch@/m);
    expect(lockfile).not.toMatch(/^ {2}'?fast-glob@/m);
  });

  it('routes every former braces dependent to a stand-in', () => {
    expect(semanticRelease.resolve('micromatch')).toContain(
      '@linejam/braces-free-micromatch/'
    );
    expect(requireFrom(commitAnalyzerDir).resolve('micromatch')).toContain(
      '@linejam/braces-free-micromatch/'
    );
    expect(requireFrom(nextPluginDir).resolve('fast-glob')).toContain(
      '@linejam/braces-free-fast-glob/'
    );
  });

  it('ships the upstream license with the code copied from micromatch', () => {
    // micromatch@4.0.8's LICENSE, byte for byte (MIT requires the copyright
    // and permission notice in all copies or substantial portions).
    const license = readFileSync(
      'tools/braces-free/micromatch/LICENSE',
      'utf8'
    );
    expect(license).toContain('Copyright (c) 2014-present, Jon Schlinkert.');
    expect(license).toContain(
      'The above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.'
    );
    expect(
      readFileSync('tools/braces-free/micromatch/index.cjs', 'utf8')
    ).toContain('./LICENSE');
  });

  // Expected values were captured from micromatch@4.0.8 before it was removed.
  it('matches micromatch list filtering for semantic-release branch patterns', () => {
    // SAFETY: the routing test above pins this to the micromatch stand-in, whose
    // default export is the micromatch(list, patterns) function with isMatch.
    const micromatch = semanticRelease('micromatch') as Micromatch;
    const branches = [
      'master',
      'next',
      'beta',
      '1.x',
      '2.x',
      'feature/a',
      'release/1.0',
    ];
    expect(micromatch(branches, 'master')).toEqual(['master']);
    expect(micromatch(branches, '+([0-9])?(.{+([0-9]),x}).x')).toEqual([
      '1.x',
      '2.x',
    ]);
    expect(micromatch(branches, ['*', '!next'])).toEqual([
      'master',
      'beta',
      '1.x',
      '2.x',
    ]);
    expect(micromatch(branches, ['!beta', '!1.x'])).toEqual([
      'master',
      'next',
      '2.x',
      'feature/a',
      'release/1.0',
    ]);
    expect(micromatch(branches, 'feature/*')).toEqual(['feature/a']);
    expect(micromatch(branches, '{beta,next}')).toEqual(['next', 'beta']);
  });

  it('matches micromatch.isMatch for commit-analyzer release rules', () => {
    // SAFETY: the routing test above pins this to the micromatch stand-in.
    const { isMatch } = requireFrom(commitAnalyzerDir)(
      'micromatch'
    ) as Micromatch;
    expect(isMatch('feat', 'feat')).toBe(true);
    expect(isMatch('feat', '{feat,fix}')).toBe(true);
    expect(isMatch('fix', 'f*')).toBe(true);
    expect(isMatch('docs', '!docs')).toBe(false);
    expect(isMatch('README.md', 'README.*')).toBe(true);
    expect(isMatch('scope-a', 'scope-{a,b}')).toBe(true);
  });

  it('matches fast-glob directory globbing for the Next lint root dirs', () => {
    // SAFETY: @next/eslint-plugin-next ships get-root-dirs.d.ts with this
    // getRootDirs(context) => string[] signature.
    const { getRootDirs } = requireFrom(nextPluginDir)(
      './dist/utils/get-root-dirs.js'
    ) as {
      getRootDirs: (context: {
        cwd: string;
        settings: { next?: { rootDir?: string | string[] } };
      }) => string[];
    };
    const rootDirs = (rootDir: string | string[]) =>
      getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir } } });

    expect(rootDirs('app')).toEqual(['app']);
    expect(rootDirs(['app', 'missing-root-dir'])).toEqual(['app']);
    expect(rootDirs('tests/*/').sort()).toContain('tests/scripts');
    expect(rootDirs('tests/*').every((dir) => !dir.endsWith('/'))).toBe(true);
  });

  it('accepts only the { onlyDirectories: true } call the Next plugin makes', () => {
    // SAFETY: the routing test above pins this to the fast-glob stand-in.
    // Its signature is widened so unsupported calls can be passed.
    const { globSync } = requireFrom(nextPluginDir)('fast-glob') as {
      globSync: (
        pattern?: string | readonly string[],
        options?: UnsupportedGlobOptions
      ) => string[];
    };
    expect(globSync('app', { onlyDirectories: true })).toEqual(['app']);

    expect(() => globSync('app', { onlyDirectories: true, dot: true })).toThrow(
      'Unsupported fast-glob option in stand-in: dot'
    );
    expect(() => globSync('app', { dot: true })).toThrow(
      'Unsupported fast-glob option in stand-in: dot'
    );
    for (const options of [
      undefined,
      null,
      {},
      { onlyDirectories: false },
      { onlyDirectories: 'true' },
      { onlyDirectories: 1 },
      [],
    ]) {
      expect(() => globSync('app', options)).toThrow(
        'fast-glob stand-in supports only { onlyDirectories: true }'
      );
    }
    expect(() => globSync()).toThrow(
      'fast-glob stand-in supports only a single string pattern'
    );
    expect(() => globSync(['app'], { onlyDirectories: true })).toThrow(
      'fast-glob stand-in supports only a single string pattern'
    );
  });
});
