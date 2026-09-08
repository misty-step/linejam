/** @vitest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReleaseCatalog, readReleaseSources } from '@/lib/releases/loader';
import { generateReleases } from '@/scripts/generate-releases';
import type { LandmarkReleaseEntry } from '@/lib/releases/types';

const roots: string[] = [];
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linejam-releases-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'content/releases/v1.15.1'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ version: '0.27.0' })
  );
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    `# Changelog

# [0.27.0](https://example.test/compare) (2026-08-01)

### Features

- feat(lobby): show the room status board

## [1.15.1] - 2026-07-04

### Bug Fixes

- fix: keep live rooms connected
`
  );
  fs.writeFileSync(
    path.join(root, 'content/releases/v1.15.1/notes.md'),
    'Rooms stay connected.'
  );
  fs.writeFileSync(
    path.join(root, 'content/releases/manifest.json'),
    JSON.stringify({
      latest: '1.15.1',
      versions: ['1.15.1'],
      generatedAt: '2026-07-04',
    })
  );
  return root;
}

function landmarkNotes(root: string): LandmarkReleaseEntry {
  const entry: LandmarkReleaseEntry = {
    schema_version: 'landmark.public-release-notes.v1',
    version: '0.27.0',
    tag: 'v0.27.0',
    repository: 'misty-step/linejam',
    audience: 'end-user',
    notes: '## Improvements\n\n- See who is ready in the lobby.',
    markdown: '## Improvements\n\n- See who is ready in the lobby.',
    plaintext: 'Improvements\n\nSee who is ready in the lobby.',
    html: '<h2>Improvements</h2><ul><li>See who is ready in the lobby.</li></ul>',
    slack: 'See who is ready in the lobby.',
    sections: [
      {
        title: 'Improvements',
        bullets: [{ text: 'See who is ready in the lobby.', links: [] }],
      },
    ],
    // Artifact creation is not release chronology.
    published_at: '2030-01-01T00:00:00Z',
  };
  fs.mkdirSync(path.join(root, 'content/releases/v0.27.0'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, 'content/releases/landmark.json'),
    JSON.stringify([entry])
  );
  fs.writeFileSync(
    path.join(root, 'content/releases/v0.27.0/notes.md'),
    entry.markdown
  );
  return entry;
}

afterEach(() => {
  vi.useRealTimers();
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('release catalog authority', () => {
  it('does not let a higher historical manifest version override the current release', () => {
    const root = fixture();
    const catalog = loadReleaseCatalog(root);
    expect(catalog.currentVersion).toBe('0.27.0');
    expect(catalog.releases.map((release) => release.version)).toEqual([
      '0.27.0',
      '1.15.1',
    ]);
    expect(catalog.releases[0]).toMatchObject({
      notesStatus: 'missing',
      productNotes: '',
    });
    expect(catalog.releases[1]).toMatchObject({
      notesStatus: 'legacy',
      productNotes: 'Rooms stay connected.',
    });
    expect(
      catalog.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ).toBe(true);
    generateReleases({ root });
    expect(
      loadReleaseCatalog(root).diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'error'
      )
    ).toEqual([]);
  });

  it('preserves published legacy notes without treating them as new Landmark synthesis', () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, 'content/releases/legacy-notes.json'),
      JSON.stringify({
        schemaVersion: 1,
        source: 'archived feed fixture',
        sourceSha256: '0'.repeat(64),
        releases: [
          {
            version: '1.15.1',
            html: '<p>Your room stays connected.</p>',
            plaintext: 'Your room stays connected.',
          },
        ],
      })
    );
    generateReleases({ root });
    expect(loadReleaseCatalog(root).releases[1]).toMatchObject({
      notesStatus: 'legacy',
      productNotes: 'Your room stays connected.',
    });
    expect(
      fs.readFileSync(
        path.join(root, 'content/releases/v1.15.1/notes.md'),
        'utf8'
      )
    ).toBe('Rooms stay connected.');
  });

  it('rejects malformed Landmark notes before changing any projection', () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, 'content/releases/landmark.json'),
      JSON.stringify([{ version: '0.27.0', notes: 'Unvalidated copy' }])
    );
    const original = fs.readFileSync(
      path.join(root, 'content/releases/manifest.json'),
      'utf8'
    );
    expect(readReleaseSources(root).releases[0].productNotes).toBe('');
    expect(() => generateReleases({ root })).toThrow();
    expect(
      fs.readFileSync(path.join(root, 'content/releases/manifest.json'), 'utf8')
    ).toBe(original);
    expect(fs.existsSync(path.join(root, 'site/changelog.html'))).toBe(false);
  });

  it('requires Landmark JSON and markdown to agree, then renders plaintext without changing the release date', () => {
    const root = fixture();
    const entry = landmarkNotes(root);
    fs.writeFileSync(
      path.join(root, 'content/releases/v0.27.0/notes.md'),
      'Unrelated notes'
    );
    expect(() => generateReleases({ root })).toThrow();
    fs.writeFileSync(
      path.join(root, 'content/releases/v0.27.0/notes.md'),
      entry.markdown
    );
    generateReleases({ root });
    expect(loadReleaseCatalog(root).releases[0]).toMatchObject({
      date: '2026-08-01',
      notesStatus: 'landmark',
      productNotes: entry.plaintext,
    });
  });

  it('records a policy skip separately from a missing release note', () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, 'content/releases/v0.27.0'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'content/releases/v0.27.0/synthesis.json'),
      JSON.stringify({ quality: 'skipped' })
    );
    generateReleases({ root });
    expect(loadReleaseCatalog(root).releases[0]).toMatchObject({
      notesStatus: 'skipped',
      productNotes: '',
    });
  });

  it('generates all projections idempotently and detects drift without rewriting it', () => {
    const root = fixture();
    landmarkNotes(root);
    const outputs = generateReleases({ root });
    const before = outputs.map((filename) =>
      fs.readFileSync(path.join(root, filename), 'utf8')
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2040-05-01T12:00:00Z'));
    expect(generateReleases({ root })).toEqual([]);
    expect(
      outputs.map((filename) =>
        fs.readFileSync(path.join(root, filename), 'utf8')
      )
    ).toEqual(before);
    fs.writeFileSync(path.join(root, 'site/changelog.html'), 'stale page');
    expect(() => generateReleases({ root, check: true })).toThrow();
    expect(
      fs.readFileSync(path.join(root, 'site/changelog.html'), 'utf8')
    ).toBe('stale page');
  });

  it('keeps this repository projections in sync with its release sources', () => {
    expect(generateReleases({ dryRun: true })).toEqual([]);
  });
});
