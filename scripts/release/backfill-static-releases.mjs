#!/usr/bin/env node
/**
 * One-time (and re-runnable) backfill: walk every v1.x.y git tag and write
 * its content/releases/vX.Y.Z/changelog.json from the deterministic
 * conventional-commit history between it and the previous tag. Does NOT
 * fabricate product notes for historical versions -- notes.md is only
 * written where real synthesized prose already exists (see
 * docs/releases-static-store.md). Regenerates manifest.json once at the end.
 *
 * Usage: node scripts/release/backfill-static-releases.mjs
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeReleaseFromGit } from './write-release-from-git.mjs';
import { regenerateManifest } from './static-release-store.mjs';

function exec(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function listVersionTags() {
  return exec('git', ['tag', '--list', 'v1.*'])
    .split('\n')
    .filter(Boolean)
    .sort((a, b) => {
      const pa = a.replace(/^v/, '').split('.').map(Number);
      const pb = b.replace(/^v/, '').split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
}

export function runBackfill() {
  const tags = listVersionTags();
  const written = [];

  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const previousTag = i > 0 ? tags[i - 1] : undefined;
    writeReleaseFromGit({
      version: tag.replace(/^v/, ''),
      tag,
      previousTag,
      exec,
    });
    written.push(tag);
  }

  const manifest = regenerateManifest();
  return { written, manifest };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBackfill();
  console.log(
    `Backfilled ${result.written.length} versions: ${result.written.join(', ')}`
  );
  console.log(`manifest.json latest=${result.manifest.latest}`);
}
