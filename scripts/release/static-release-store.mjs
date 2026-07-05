#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// Mirrors lib/releases/loader.ts's CONTENT_DIR. Kept as a separate constant
// (not imported from the .ts loader) because this script runs as plain
// Node outside the Next.js build, and the two sides of the contract --
// writer here, reader in lib/releases/loader.ts -- are proven to agree by
// tests/scripts/release-manifest-version.test.ts and the e2e /releases
// smoke, not by a shared import across that runtime boundary.
const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'content', 'releases');

function versionDir(contentDir, version) {
  return path.join(contentDir, `v${version.replace(/^v/, '')}`);
}

/**
 * @param {{
 *   version: string,
 *   date: string,
 *   changes: unknown[],
 *   compareUrl?: string,
 *   notes?: string,
 *   contentDir?: string,
 * }} params
 */
export function writeReleaseEntry({
  version,
  date,
  changes,
  compareUrl,
  notes,
  contentDir = DEFAULT_CONTENT_DIR,
}) {
  const dir = versionDir(contentDir, version);
  fs.mkdirSync(dir, { recursive: true });

  const changelog = {
    version: version.replace(/^v/, ''),
    date,
    changes,
    ...(compareUrl ? { compareUrl } : {}),
  };
  fs.writeFileSync(
    path.join(dir, 'changelog.json'),
    `${JSON.stringify(changelog, null, 2)}\n`
  );

  const notesPath = path.join(dir, 'notes.md');
  if (notes?.trim()) {
    fs.writeFileSync(notesPath, notes.endsWith('\n') ? notes : `${notes}\n`);
  } else if (fs.existsSync(notesPath)) {
    // A version that previously had notes should not silently keep stale
    // ones if re-written without notes -- but this only fires on an
    // explicit re-write, never on first write.
    fs.rmSync(notesPath);
  }
}

/**
 * Compare two "x.y.z" version strings numerically (semver-lite: this repo
 * has no pre-release/build-metadata suffixes to worry about).
 */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Regenerate manifest.json from the version directories actually present on
 * disk, so the manifest can never drift from the content it is meant to
 * index (the exact failure class this whole card exists to fix -- see
 * docs release split-brain writeup).
 *
 * @param {{ contentDir?: string, now?: () => string }} [params]
 */
export function regenerateManifest({
  contentDir = DEFAULT_CONTENT_DIR,
  now = () => new Date().toISOString(),
} = {}) {
  const entries = fs.existsSync(contentDir) ? fs.readdirSync(contentDir) : [];
  const versions = entries
    .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
    .filter((name) =>
      fs.existsSync(path.join(contentDir, name, 'changelog.json'))
    )
    .map((name) => name.slice(1))
    .sort(compareVersions)
    .reverse();

  const manifest = {
    latest: versions[0] ?? '',
    versions,
    generatedAt: now(),
  };

  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(
    path.join(contentDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  return manifest;
}
