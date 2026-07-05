/** @vitest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareVersions,
  regenerateManifest,
  writeReleaseEntry,
} from '@/scripts/release/static-release-store.mjs';

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linejam-releases-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('compareVersions', () => {
  it('orders numerically, not lexicographically', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('writeReleaseEntry', () => {
  it('writes changelog.json with the version, date, and changes', () => {
    const contentDir = makeTmpDir();
    writeReleaseEntry({
      version: '1.15.2',
      date: '2026-07-05',
      changes: [{ type: 'fix', description: 'x', breaking: false }],
      contentDir,
    });

    const changelog = JSON.parse(
      fs.readFileSync(
        path.join(contentDir, 'v1.15.2', 'changelog.json'),
        'utf8'
      )
    );
    expect(changelog).toEqual({
      version: '1.15.2',
      date: '2026-07-05',
      changes: [{ type: 'fix', description: 'x', breaking: false }],
    });
  });

  it('writes notes.md only when notes are non-empty', () => {
    const contentDir = makeTmpDir();
    writeReleaseEntry({
      version: '1.0.0',
      date: '2026-01-01',
      changes: [],
      contentDir,
    });

    expect(fs.existsSync(path.join(contentDir, 'v1.0.0', 'notes.md'))).toBe(
      false
    );

    writeReleaseEntry({
      version: '1.0.1',
      date: '2026-01-02',
      changes: [],
      notes: 'Hello world',
      contentDir,
    });
    expect(
      fs.readFileSync(path.join(contentDir, 'v1.0.1', 'notes.md'), 'utf8')
    ).toBe('Hello world\n');
  });
});

describe('regenerateManifest', () => {
  it('indexes only version directories that have a changelog.json, sorted newest-first', () => {
    const contentDir = makeTmpDir();
    writeReleaseEntry({ version: '1.0.0', date: 'd', changes: [], contentDir });
    writeReleaseEntry({
      version: '1.10.0',
      date: 'd',
      changes: [],
      contentDir,
    });
    writeReleaseEntry({ version: '1.9.0', date: 'd', changes: [], contentDir });
    fs.mkdirSync(path.join(contentDir, 'v-not-a-real-version'), {
      recursive: true,
    });

    const manifest = regenerateManifest({
      contentDir,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(manifest).toEqual({
      latest: '1.10.0',
      versions: ['1.10.0', '1.9.0', '1.0.0'],
      generatedAt: '2026-07-05T00:00:00.000Z',
    });

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8')
    );
    expect(onDisk).toEqual(manifest);
  });

  it('produces an empty manifest when no version directories exist yet', () => {
    const contentDir = makeTmpDir();
    fs.rmSync(contentDir, { recursive: true, force: true });

    const manifest = regenerateManifest({
      contentDir,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(manifest).toEqual({
      latest: '',
      versions: [],
      generatedAt: '2026-07-05T00:00:00.000Z',
    });
  });
});
