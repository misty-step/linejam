#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { deriveChangesForRange } from './conventional-commits.mjs';
import {
  regenerateManifest,
  writeReleaseEntry,
} from './static-release-store.mjs';

function defaultExec(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

/**
 * Write one release's static content/releases entry from git history
 * between two tags (or from the repo root to a single tag), then
 * regenerate manifest.json. Used both by the release workflow (one release
 * at a time, immediately after Landmark tags it) and by the one-time v1.x
 * backfill script (looped over every historical tag pair).
 *
 * @param {{
 *   version: string,
 *   tag: string,
 *   previousTag?: string,
 *   notes?: string,
 *   compareUrl?: string,
 *   exec?: (command: string, args: string[]) => string,
 *   contentDir?: string,
 * }} params
 */
export function writeReleaseFromGit({
  version,
  tag,
  previousTag,
  notes,
  compareUrl,
  exec = defaultExec,
  contentDir,
}) {
  const range = previousTag ? `${previousTag}..${tag}` : tag;
  const changes = deriveChangesForRange(range, exec);
  const date = exec('git', ['log', '-1', '--format=%aI', tag]).slice(0, 10);

  writeReleaseEntry({ version, date, changes, notes, compareUrl, contentDir });
  return regenerateManifest({ contentDir });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=')];
    })
  );

  if (!args.tag) {
    console.error(
      'Usage: write-release-from-git.mjs --tag=v1.15.2 [--previous-tag=v1.15.1] [--notes-file=path] [--compare-url=url]'
    );
    process.exit(2);
  }

  const version = args.tag.replace(/^v/, '');
  let notes = '';
  if (args['notes-file']) {
    try {
      notes = defaultExec('cat', [args['notes-file']]);
    } catch {
      notes = '';
    }
  }

  const manifest = writeReleaseFromGit({
    version,
    tag: args.tag,
    previousTag: args['previous-tag'],
    notes,
    compareUrl: args['compare-url'],
  });

  console.log(JSON.stringify(manifest));
}
