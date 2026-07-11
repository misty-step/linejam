#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const provider = ['ver', 'cel'].join('');
const providerEnvPrefix = provider.toUpperCase() + '_';
const historicalRoots = [
  '.groom',
  'CHANGELOG.md',
  'backlog.d',
  'content/releases',
  'docs/evidence',
  'docs/labs',
  'docs/solutions',
];
const ignoredRoots = [
  '.git',
  '.next',
  '.pnpm-store',
  '.qa',
  '.vercel',
  'coverage',
  'node_modules',
  'playwright-report',
  'test-results',
];
const forbiddenNames = new Set([`${provider}.json`, `.${provider}ignore`]);
const forbiddenMarkers = [
  `@${provider}/analytics`,
  `@${provider}/speed-insights`,
  providerEnvPrefix,
  `x-${provider}-`,
  `_${provider}/`,
  `${provider}.app`,
  `${provider}-insights`,
  `${provider}-scripts`,
  `${provider} deploy`,
];

function isWithin(relativePath, roots) {
  return roots.some(
    (entry) => relativePath === entry || relativePath.startsWith(`${entry}/`)
  );
}

async function collect(relativeDir = '') {
  const entries = await readdir(path.join(root, relativeDir), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (isWithin(relativePath, ignoredRoots)) continue;
    if (isWithin(relativePath, historicalRoots)) continue;

    if (entry.isDirectory()) {
      files.push(...(await collect(relativePath)));
    } else if (
      entry.isFile() &&
      !relativePath.endsWith('.tsbuildinfo') &&
      (!path.basename(relativePath).startsWith('.env') ||
        path.basename(relativePath) === '.env.example')
    ) {
      files.push(relativePath);
    }
  }

  return files;
}

const violations = [];
for (const relativePath of await collect()) {
  if (forbiddenNames.has(path.basename(relativePath))) {
    violations.push(`${relativePath}: retired provider manifest`);
    continue;
  }

  let content;
  try {
    content = await readFile(path.join(root, relativePath), 'utf8');
  } catch {
    continue;
  }

  for (const marker of forbiddenMarkers) {
    if (content.toLowerCase().includes(marker.toLowerCase())) {
      violations.push(`${relativePath}: ${marker}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Active retired-provider runtime markers found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('provider-retirement: active runtime is provider-portable');
