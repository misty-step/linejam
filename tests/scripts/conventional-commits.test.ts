/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  commitToChangelogEntry,
  deriveChangesForRange,
  parseConventionalCommit,
} from '@/scripts/release/conventional-commits.mjs';

describe('parseConventionalCommit', () => {
  it('parses type, scope, and description', () => {
    expect(
      parseConventionalCommit('fix(csp): allow the custom domain')
    ).toEqual({
      type: 'fix',
      scope: 'csp',
      breaking: false,
      description: 'allow the custom domain',
    });
  });

  it('parses a PR number trailer', () => {
    expect(
      parseConventionalCommit(
        'feat: make reveal shareable and teach first writers (#292)'
      )
    ).toEqual({
      type: 'feat',
      breaking: false,
      description: 'make reveal shareable and teach first writers',
      pr: 292,
    });
  });

  it('detects a breaking change via the ! marker', () => {
    const result = parseConventionalCommit(
      'feat(api)!: remove legacy endpoint'
    );
    expect(result?.breaking).toBe(true);
  });

  it('detects a breaking change via a BREAKING CHANGE footer', () => {
    const result = parseConventionalCommit(
      'feat(api): widen the response shape',
      'Some body text.\n\nBREAKING CHANGE: removes the old field entirely.'
    );
    expect(result?.breaking).toBe(true);
  });

  it('returns null for a non-conventional subject', () => {
    expect(parseConventionalCommit('Merge pull request #42')).toBeNull();
  });

  it('returns null for an unknown type', () => {
    expect(parseConventionalCommit('wip: half-finished thing')).toBeNull();
  });

  it('filters out release-automation noise commits (scope release/feed)', () => {
    expect(
      parseConventionalCommit('chore(release): 1.15.1 [skip ci]')
    ).toBeNull();
    expect(
      parseConventionalCommit(
        'chore(feed): update releases feed for v1.15.1 [skip ci]'
      )
    ).toBeNull();
  });
});

describe('commitToChangelogEntry', () => {
  it('attaches a short commit hash to a parsed entry', () => {
    const entry = commitToChangelogEntry({
      hash: '8b8da9112233445566778899aabbccddeeff001',
      subject: 'fix(csp): allow the production Clerk custom domain (#299)',
      body: '',
    });

    expect(entry).toEqual({
      type: 'fix',
      scope: 'csp',
      breaking: false,
      description: 'allow the production Clerk custom domain',
      pr: 299,
      commit: '8b8da91',
    });
  });

  it('returns null for a commit that is not conventional', () => {
    expect(
      commitToChangelogEntry({ hash: 'abc1234', subject: 'oops', body: '' })
    ).toBeNull();
  });
});

describe('deriveChangesForRange', () => {
  it('parses the git log output into oldest-first changelog entries, dropping non-conventional commits', () => {
    const exec = vi
      .fn()
      .mockReturnValue(
        [
          'hash2\x1ffix: second thing\x1f\x1e',
          'hash1\x1ffeat: first thing (#10)\x1f\x1e',
          'hash0\x1fnot conventional\x1f\x1e',
        ].join('')
      );

    const changes = deriveChangesForRange('v1.0.0..v1.1.0', exec);

    expect(changes).toEqual([
      {
        type: 'feat',
        breaking: false,
        description: 'first thing',
        pr: 10,
        commit: 'hash1',
      },
      {
        type: 'fix',
        breaking: false,
        description: 'second thing',
        commit: 'hash2',
      },
    ]);
    expect(exec).toHaveBeenCalledWith('git', [
      'log',
      'v1.0.0..v1.1.0',
      expect.stringContaining('%H'),
    ]);
  });

  it('returns an empty array for an empty range', () => {
    const exec = vi.fn().mockReturnValue('');
    expect(deriveChangesForRange('v1.0.0..v1.0.0', exec)).toEqual([]);
  });
});
