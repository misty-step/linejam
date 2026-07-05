/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// linejam-915: the releases page went stale at v0.1.0 for months while
// package.json (and Landmark's own RSS feed) moved on to v1.15.1, because
// two separate stores existed with nothing keeping them in sync. This test
// is the gate: it runs on every `pnpm test`/CI invocation, so a manifest
// that drifts from package.json fails the build immediately rather than
// silently rotting again.
describe('content/releases/manifest.json matches package.json', () => {
  const repoRoot = path.join(__dirname, '..', '..');
  const manifestPath = path.join(
    repoRoot,
    'content',
    'releases',
    'manifest.json'
  );
  const packageJsonPath = path.join(repoRoot, 'package.json');

  it('has "latest" equal to the package.json version', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(manifest.latest).toBe(packageJson.version);
  });

  it('lists the latest version first', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.versions[0]).toBe(manifest.latest);
  });

  it('has a changelog.json for every version it lists', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const version of manifest.versions) {
      const changelogPath = path.join(
        repoRoot,
        'content',
        'releases',
        `v${version}`,
        'changelog.json'
      );
      expect(fs.existsSync(changelogPath)).toBe(true);
    }
  });
});
