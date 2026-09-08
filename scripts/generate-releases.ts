#!/usr/bin/env npx tsx
/** Project checked-in Landmark notes and technical history. No provider calls. */
import fs from 'node:fs';
import path from 'node:path';
import { readReleaseSources, releaseManifest } from '../lib/releases/loader';
import type { Release } from '../lib/releases/types';
import { renderReleaseFeed } from '../lib/releases/feed';
import { renderSiteChangelogHtml } from './releases/site-changelog';

export function generateReleases({
  root = process.cwd(),
  check = false,
  dryRun = false,
}: { root?: string; check?: boolean; dryRun?: boolean } = {}): string[] {
  const catalog = readReleaseSources(root);
  for (const diagnostic of catalog.diagnostics) {
    console.warn(`${diagnostic.severity}: ${diagnostic.message}`);
  }
  if (
    catalog.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  ) {
    throw new Error(
      'Release sources are invalid; no projections were written.'
    );
  }
  const outputs = new Map<string, string>([
    [
      'content/releases/manifest.json',
      `${JSON.stringify(releaseManifest(catalog), null, 2)}\n`,
    ],
    ['site/changelog.html', renderSiteChangelogHtml(catalog)],
    ['docs/releases/feed.xml', renderReleaseFeed(catalog)],
  ]);
  for (const release of catalog.releases) {
    const technical: Release = {
      version: release.version,
      date: release.date,
      changes: release.changes,
    };
    if (release.compareUrl) {
      technical.compareUrl = release.compareUrl;
    }
    outputs.set(
      `content/releases/v${release.version}/changelog.json`,
      `${JSON.stringify(technical, null, 2)}\n`
    );
  }
  const changed: string[] = [];
  for (const [relative, content] of outputs) {
    const filename = path.join(root, relative);
    if (
      fs.existsSync(filename) &&
      fs.readFileSync(filename, 'utf8') === content
    )
      continue;
    changed.push(relative);
    if (!check && !dryRun) {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, content);
    }
  }
  if (check && changed.length > 0) {
    throw new Error(
      `Release projections are out of sync:\n${changed.join('\n')}\nRun pnpm generate:releases and commit the results.`
    );
  }
  return changed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    for (const arg of args) {
      if (!['--check', '--dry-run'].includes(arg))
        throw new Error(`Unknown argument: ${arg}`);
    }
    const changed = generateReleases({
      check: args.includes('--check'),
      dryRun: args.includes('--dry-run'),
    });
    console.log(
      changed.length > 0
        ? `${args.includes('--dry-run') ? 'Would update' : 'Updated'}:\n${changed.join('\n')}`
        : 'Release projections are up to date.'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
