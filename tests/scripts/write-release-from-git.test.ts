/** @vitest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultExec,
  parseCliArgs,
  readNotesFile,
  writeReleaseFromGit,
} from '@/scripts/release/write-release-from-git.mjs';

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linejam-write-release-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('writeReleaseFromGit', () => {
  it('derives changes from the tag range and writes changelog.json + manifest.json', () => {
    const contentDir = makeTmpDir();
    const exec = vi.fn((command, cmdArgs) => {
      if (cmdArgs[0] === 'log' && cmdArgs.includes('-1')) {
        return '2026-07-05T12:00:00-05:00';
      }
      // git log <range> --pretty=...
      return [
        'abc1234\x1ffix(csp): allow the custom domain (#299)\x1f\x1e',
      ].join('');
    });

    const manifest = writeReleaseFromGit({
      version: '1.15.2',
      tag: 'v1.15.2',
      previousTag: 'v1.15.1',
      exec,
      contentDir,
    });

    expect(manifest.latest).toBe('1.15.2');
    expect(manifest.versions).toEqual(['1.15.2']);

    const changelog = JSON.parse(
      fs.readFileSync(
        path.join(contentDir, 'v1.15.2', 'changelog.json'),
        'utf8'
      )
    );
    expect(changelog.date).toBe('2026-07-05');
    expect(changelog.changes).toEqual([
      {
        type: 'fix',
        scope: 'csp',
        breaking: false,
        description: 'allow the custom domain',
        pr: 299,
        commit: 'abc1234',
      },
    ]);

    expect(exec).toHaveBeenCalledWith('git', [
      'log',
      'v1.15.1..v1.15.2',
      expect.stringContaining('%H'),
    ]);
  });

  it('uses a bare tag as the range when there is no previous tag (first release)', () => {
    const contentDir = makeTmpDir();
    const exec = vi.fn((command, cmdArgs) => {
      if (cmdArgs[0] === 'log' && cmdArgs.includes('-1')) {
        return '2026-01-01T00:00:00Z';
      }
      return '';
    });

    writeReleaseFromGit({
      version: '1.0.0',
      tag: 'v1.0.0',
      exec,
      contentDir,
    });

    expect(exec).toHaveBeenCalledWith('git', [
      'log',
      'v1.0.0',
      expect.stringContaining('%H'),
    ]);
  });

  it('threads notes through to notes.md', () => {
    const contentDir = makeTmpDir();
    const exec = vi.fn((command, cmdArgs) => {
      if (cmdArgs[0] === 'log' && cmdArgs.includes('-1')) {
        return '2026-07-05T00:00:00Z';
      }
      return '';
    });

    writeReleaseFromGit({
      version: '1.15.2',
      tag: 'v1.15.2',
      previousTag: 'v1.15.1',
      notes: 'Great release.',
      exec,
      contentDir,
    });

    expect(
      fs.readFileSync(path.join(contentDir, 'v1.15.2', 'notes.md'), 'utf8')
    ).toBe('Great release.\n');
  });
});

describe('parseCliArgs', () => {
  it('parses --key=value pairs', () => {
    expect(parseCliArgs(['--tag=v1.15.2', '--previous-tag=v1.15.1'])).toEqual({
      tag: 'v1.15.2',
      'previous-tag': 'v1.15.1',
    });
  });

  it('preserves "=" characters inside the value', () => {
    expect(parseCliArgs(['--compare-url=https://x?a=1'])).toEqual({
      'compare-url': 'https://x?a=1',
    });
  });

  it('returns an empty object for no args', () => {
    expect(parseCliArgs([])).toEqual({});
  });
});

describe('readNotesFile', () => {
  it('reads the file via the provided reader', () => {
    const readFile = vi.fn().mockReturnValue('release notes content');
    expect(readNotesFile('/tmp/notes.md', readFile)).toBe(
      'release notes content'
    );
    expect(readFile).toHaveBeenCalledWith('cat', ['/tmp/notes.md']);
  });

  it('returns an empty string when no path is given', () => {
    expect(readNotesFile(undefined)).toBe('');
  });

  it('returns an empty string rather than throwing when the read fails', () => {
    const readFile = vi.fn().mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(readNotesFile('/tmp/missing.md', readFile)).toBe('');
  });
});

describe('defaultExec', () => {
  it('runs a real command and trims its output', () => {
    expect(defaultExec('git', ['--version'])).toMatch(/^git version/);
  });
});
