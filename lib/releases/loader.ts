/**
 * Static release content loader.
 *
 * Reads from filesystem at build time:
 * content/releases/
 * ├── manifest.json
 * ├── v1.0.0/
 * │   ├── changelog.json
 * │   └── notes.md
 * └── ...
 */

import fs from 'fs';
import path from 'path';
import type { Release, ReleaseManifest, ReleaseWithNotes } from './types';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'releases');

/**
 * Load the release manifest.
 */
export function loadManifest(): ReleaseManifest {
  const manifestPath = path.join(CONTENT_DIR, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return {
      latest: '',
      versions: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as ReleaseManifest;
}

/**
 * Load a specific release by version.
 */
export function loadRelease(version: string): ReleaseWithNotes | null {
  const versionDir = path.join(CONTENT_DIR, `v${version.replace(/^v/, '')}`);

  const changelogPath = path.join(versionDir, 'changelog.json');
  const notesPath = path.join(versionDir, 'notes.md');

  if (!fs.existsSync(changelogPath)) {
    return null;
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf-8');
  const release = JSON.parse(changelogContent) as Release;

  let productNotes = '';
  if (fs.existsSync(notesPath)) {
    productNotes = fs.readFileSync(notesPath, 'utf-8');
  }

  return {
    ...release,
    productNotes,
  };
}

/**
 * Load all releases.
 */
export function loadAllReleases(): ReleaseWithNotes[] {
  const manifest = loadManifest();

  if (manifest.versions.length === 0) {
    return [];
  }

  const releases: ReleaseWithNotes[] = [];

  for (const version of manifest.versions) {
    const release = loadRelease(version);
    if (release) {
      releases.push(release);
    }
  }

  return releases;
}

/**
 * Get all version strings for generateStaticParams.
 */
export function getAllVersions(): string[] {
  const manifest = loadManifest();
  return manifest.versions;
}

/**
 * Get the latest version.
 */
export function getLatestVersion(): string | null {
  const manifest = loadManifest();
  return manifest.latest || null;
}

/**
 * Check if content directory exists.
 */
export function contentExists(): boolean {
  return fs.existsSync(CONTENT_DIR);
}
