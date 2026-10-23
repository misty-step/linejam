import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

type ReleaseBranch = {
  name: string;
  channel?: string;
  prerelease?: boolean;
  range?: string;
};

type ReleaseRule = {
  type?: string;
  scope?: string;
  subject?: string;
  release: string;
};

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

  // Captured regression cases: expected values were recorded from
  // micromatch@4.0.8 before it was removed. These call the stand-in directly;
  // the consumer checks below run the real semantic-release callers.
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

  // Consumer integration checks: run the installed semantic-release and
  // commit-analyzer code paths that call micromatch, not the stand-in alone.
  // Expected values were captured by running these same calls against
  // semantic-release@25.0.9 and @semantic-release/commit-analyzer@13.0.1
  // installed with the real micromatch@4.0.8. They are regression cases: an
  // upgrade that changes these consumers still needs the upgrade checks in
  // docs/adr/0014-vendored-braces-free-stand-ins.md.
  describe('semantic-release consumers of the micromatch stand-in', () => {
    let repo = '';
    beforeAll(() => {
      repo = realpathSync(mkdtempSync(join(tmpdir(), 'braces-free-release-')));
      const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
      git('init', '-q', '-b', 'master');
      git(
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'init'
      );
      for (const branch of [
        'next',
        'next-major',
        'beta',
        'alpha',
        '1.x',
        '2.x',
        '1.2.x',
        '10.x',
        'x.1',
        '1.x.x',
        'feature/a',
        'feature/b',
        'feature/c',
        'release/1.0',
        'release/2.0',
        'maint/3.x',
      ]) {
        git('branch', branch);
      }
    });
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it('expands release branches like micromatch@4.0.8', async () => {
      const expandPath = join(
        realpathSync('node_modules/semantic-release'),
        'lib/branches/expand.js'
      );
      // SAFETY: semantic-release@25 lib/branches/expand.js default-exports
      // async (repositoryUrl, { cwd }, branches) => expanded branch objects.
      const { default: expand } = (await import(
        pathToFileURL(expandPath).href
      )) as {
        default: (
          repositoryUrl: string,
          context: { cwd: string },
          branches: ReleaseBranch[]
        ) => Promise<ReleaseBranch[]>;
      };
      const run = (branches: ReleaseBranch[]) =>
        expand(repo, { cwd: repo }, branches);

      // semantic-release's default branches.
      expect(
        await run([
          { name: '+([0-9])?(.{+([0-9]),x}).x' },
          { name: 'master' },
          { name: 'main' },
          { name: 'next' },
          { name: 'next-major' },
          { name: 'beta', prerelease: true },
          { name: 'alpha', prerelease: true },
        ])
      ).toEqual([
        { name: '1.2.x' },
        { name: '1.x' },
        { name: '1.x.x' },
        { name: '10.x' },
        { name: '2.x' },
        { name: 'master' },
        { name: 'next' },
        { name: 'next-major' },
        { name: 'beta', prerelease: true },
        { name: 'alpha', prerelease: true },
      ]);
      // release.config.cjs.
      expect(await run([{ name: 'master' }])).toEqual([{ name: 'master' }]);
      // Globs, braces, extglobs and templated fields.
      expect(
        await run([
          { name: 'release/*', channel: 'ch-${name}' },
          { name: 'feature/{a,b}', prerelease: true },
          { name: 'maint/+([0-9]).x', range: '${name.slice(6)}' },
        ])
      ).toEqual([
        { name: 'release/1.0', channel: 'ch-release/1.0' },
        { name: 'release/2.0', channel: 'ch-release/2.0' },
        { name: 'feature/a', prerelease: true },
        { name: 'feature/b', prerelease: true },
        { name: 'maint/3.x', range: '3.x' },
      ]);
    });

    it('applies custom release rules like micromatch@4.0.8', async () => {
      const analyzerPath = join(realpathSync(commitAnalyzerDir), 'index.js');
      // SAFETY: @semantic-release/commit-analyzer@13 exports
      // analyzeCommits(pluginConfig, context) => release type or null.
      const { analyzeCommits } = (await import(
        pathToFileURL(analyzerPath).href
      )) as {
        analyzeCommits: (
          pluginConfig: { releaseRules: ReleaseRule[] },
          context: {
            cwd: string;
            commits: { hash: string; message: string }[];
            logger: { log: () => void };
          }
        ) => Promise<string | null>;
      };
      const releaseRules: ReleaseRule[] = [
        { type: 'docs', scope: 'README*', release: 'patch' },
        { scope: 'api-{v1,v2}', release: 'minor' },
        { type: 'perf', scope: 'core/**', release: 'minor' },
        { type: 'chore', scope: '!(deps)', release: 'patch' },
        { type: 'refactor', release: 'patch' },
        { subject: '*DROP*', release: 'major' },
      ];
      const expected: Array<[string, string | null]> = [
        ['docs(README.md): fix typo', 'patch'],
        ['docs(guide): words', null],
        ['fix(api-v1): x', 'minor'],
        ['fix(api-v3): x', 'patch'],
        ['perf(core/render): faster', 'minor'],
        ['perf(ui): faster', 'patch'],
        ['chore(deps): bump', null],
        ['chore(build): tidy', 'patch'],
        ['refactor: move', 'patch'],
        ['style(x): DROP support', 'major'],
        ['feat: add', 'minor'],
        ['fix: bug', 'patch'],
      ];
      for (const [message, release] of expected) {
        expect(
          await analyzeCommits(
            { releaseRules },
            {
              cwd: repo,
              commits: [{ hash: 'abc1234', message }],
              logger: { log: () => undefined },
            }
          ),
          message
        ).toBe(release);
      }
    });
  });

  describe('fast-glob stand-in for the Next lint root dirs', () => {
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
      getRootDirs({
        cwd: process.cwd(),
        settings: { next: { rootDir } },
      }).sort();
    // SAFETY: the routing test above pins this to the fast-glob stand-in,
    // which exports globSync and its root-preserving trimTrailingSlash helper.
    const { trimTrailingSlash } = requireFrom(nextPluginDir)('fast-glob') as {
      trimTrailingSlash: (path: string) => string;
    };

    // Fixture tree; a directory literally named `C:` exercises the Windows
    // drive-root spelling on POSIX.
    let T = '';
    beforeAll(() => {
      T = realpathSync(mkdtempSync(join(tmpdir(), 'braces-free-fast-glob-')));
      for (const dir of [
        'work/app/nested',
        'work/pkgs/a',
        'work/pkgs/b',
        'work/C:/inner',
        'work/.hidden',
        'sib/x',
      ]) {
        mkdirSync(join(T, dir), { recursive: true });
      }
      writeFileSync(join(T, 'work/file.txt'), '');
    });
    afterAll(() => rmSync(T, { recursive: true, force: true }));

    it('resolves picomatch 4 for the stand-in, not a hoisted picomatch 2', () => {
      // pnpm does not re-read a file: dependency's package.json on a plain
      // install, so a stale lockfile would silently fall back to whichever
      // picomatch is hoisted.
      const standIn = requireFrom(nextPluginDir).resolve('fast-glob');
      // SAFETY: every published picomatch package.json has a string version.
      const picomatchPackage = createRequire(standIn)(
        'picomatch/package.json'
      ) as { version: string };
      expect(picomatchPackage.version).toMatch(/^4\./);
    });

    // Expected values are regression cases captured from fast-glob@3.3.1
    // (the version @next/eslint-plugin-next pins) on this same tree:
    //   globSync(pattern, { onlyDirectories: true }).sort()
    it('returns captured fast-glob@3.3.1 results for absolute patterns', () => {
      const cases: Array<[string, string[]]> = [
        // Static patterns come back exactly as written, roots included.
        ['/', ['/']],
        [T, [T]],
        [`${T}/`, [`${T}/`]],
        [`${T}/work/app`, [`${T}/work/app`]],
        [`${T}/work/app/`, [`${T}/work/app/`]],
        [`${T}//work//app`, [`${T}/work/app`]],
        [`${T}/work/C:/`, [`${T}/work/C:/`]],
        [`${T}/work/file.txt`, []],
        // Dynamic patterns keep their absolute base and drop trailing slashes.
        [`${T}/work/*`, [`${T}/work/C:`, `${T}/work/app`, `${T}/work/pkgs`]],
        [`${T}/work/*/`, [`${T}/work/C:`, `${T}/work/app`, `${T}/work/pkgs`]],
        [`${T}/work/pkgs/*/`, [`${T}/work/pkgs/a`, `${T}/work/pkgs/b`]],
        [`${T}/work/C:/*`, [`${T}/work/C:/inner`]],
        [`${T}/work/missing/*`, []],
        [`${T}/work/**/nested`, [`${T}/work/app/nested`]],
        [`${T}/work/pkgs/{a,b}`, [`${T}/work/pkgs/a`, `${T}/work/pkgs/b`]],
        [`${T}/work/pkgs/[ab]`, [`${T}/work/pkgs/a`, `${T}/work/pkgs/b`]],
        [`${T}/work/ap?`, [`${T}/work/app`]],
      ];
      for (const [pattern, expected] of cases) {
        expect(rootDirs(pattern), pattern).toEqual(expected);
      }
    });

    it('returns captured fast-glob@3.3.1 results for relative patterns', () => {
      expect(rootDirs('.')).toEqual(['.']);
      expect(rootDirs('app')).toEqual(['app']);
      expect(rootDirs('app/')).toEqual(['app/']);
      expect(rootDirs('./app')).toEqual(['./app']);
      expect(rootDirs('./app/')).toEqual(['./app/']);
      expect(rootDirs(['app', 'missing-root-dir'])).toEqual(['app']);
      expect(rootDirs('package.json')).toEqual([]);
      expect(rootDirs('./tests/*/')).toContain('./tests/scripts');
      expect(rootDirs('tests/*')).toContain('tests/scripts');
      expect(rootDirs('tests/*').every((dir) => !dir.endsWith('/'))).toBe(true);
    });

    it('keeps the deliberate divergence for `?` with a trailing slash', () => {
      // fast-glob@3.3.1 returns [] here although `${T}/work/ap?` matches.
      expect(rootDirs(`${T}/work/ap?/`)).toEqual([`${T}/work/app`]);
    });

    it('never turns a filesystem root into an empty or drive-relative path', () => {
      expect(trimTrailingSlash('/')).toBe('/');
      expect(trimTrailingSlash('C:/')).toBe('C:/');
      expect(trimTrailingSlash('c:/')).toBe('c:/');
      expect(trimTrailingSlash('/srv/app/')).toBe('/srv/app');
      expect(trimTrailingSlash('C:/work//')).toBe('C:/work');
      expect(trimTrailingSlash('app/')).toBe('app');
      expect(trimTrailingSlash('C:')).toBe('C:');
    });
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
