#!/usr/bin/env npx tsx
/**
 * Generate static release content from CHANGELOG.md.
 *
 * Usage:
 *   pnpm generate:releases           # Generate missing only
 *   pnpm generate:releases --force   # Regenerate all
 *   pnpm generate:releases --dry-run # Parse only, no writes
 *
 * Process:
 * 1. Parse CHANGELOG.md
 * 2. For each release not in content/releases/:
 *    - Generate product notes via OpenRouter (Gemini Flash)
 *    - Write changelog.json and notes.md
 * 3. Update manifest.json
 */

import fs from 'fs';
import path from 'path';
import type {
  Release,
  ReleaseManifest,
  ChangelogEntry,
} from '../lib/releases/types';
import { parseChangelog } from '../lib/releases/parser';
import { TYPE_LABELS } from '../lib/releases/types';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'releases');
const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md');

// CLI args
const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');

/**
 * Generate product-friendly notes from technical changelog entries.
 */
async function generateProductNotes(release: Release): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY not set, using fallback notes');
    return generateFallbackNotes(release);
  }

  const changesText = release.changes
    .map((c) => `- ${c.type}${c.scope ? `(${c.scope})` : ''}: ${c.description}`)
    .join('\n');

  const prompt = `You are a product marketer writing release notes for a web app called Linejam - a real-time collaborative poetry game.

Convert these technical changelog entries into user-friendly release notes:

Version: ${release.version}
Date: ${release.date}

Technical changes:
${changesText}

Write 2-4 short paragraphs that:
1. Lead with the most impactful user-facing change
2. Use plain language, not technical jargon
3. Focus on benefits to players
4. Keep it conversational and warm
5. Skip internal/technical changes users don't care about

Output only the release notes text, no headers or version numbers.`;

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://linejam.app',
          'X-Title': 'Linejam Release Notes Generator',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return generateFallbackNotes(release);
    }

    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content?.trim() ||
      generateFallbackNotes(release)
    );
  } catch (error) {
    console.error('Failed to generate notes:', error);
    return generateFallbackNotes(release);
  }
}

/**
 * Generate simple fallback notes when LLM unavailable.
 */
function generateFallbackNotes(release: Release): string {
  const grouped = groupByType(release.changes);
  const lines: string[] = [];

  // Lead with features if any
  if (grouped.feat?.length) {
    lines.push(
      `This release brings ${grouped.feat.length} new feature${grouped.feat.length > 1 ? 's' : ''} to Linejam.`
    );
  }

  // Mention fixes
  if (grouped.fix?.length) {
    lines.push(
      `We've also squashed ${grouped.fix.length} bug${grouped.fix.length > 1 ? 's' : ''} to make the game smoother.`
    );
  }

  // Generic fallback
  if (lines.length === 0) {
    lines.push('Various improvements and updates to make Linejam better.');
  }

  return lines.join('\n\n');
}

/**
 * Group changes by type.
 */
function groupByType(
  changes: ChangelogEntry[]
): Partial<Record<string, ChangelogEntry[]>> {
  return changes.reduce(
    (acc, change) => {
      const type = change.type;
      if (!acc[type]) acc[type] = [];
      acc[type]!.push(change);
      return acc;
    },
    {} as Partial<Record<string, ChangelogEntry[]>>
  );
}

/**
 * Write release content to disk.
 */
function writeRelease(release: Release, productNotes: string): void {
  const versionDir = path.join(
    CONTENT_DIR,
    `v${release.version.replace(/^v/, '')}`
  );

  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  // Write changelog.json
  const changelogPath = path.join(versionDir, 'changelog.json');
  fs.writeFileSync(changelogPath, JSON.stringify(release, null, 2));

  // Write notes.md
  const notesPath = path.join(versionDir, 'notes.md');
  fs.writeFileSync(notesPath, productNotes);

  console.log(`  ✅ Wrote ${release.version}`);
}

/**
 * Update the manifest.
 */
function writeManifest(releases: Release[]): void {
  // Sort by semver descending
  const sorted = [...releases].sort((a, b) => {
    const [aMaj, aMin, aPat] = a.version
      .replace(/^v/, '')
      .split('.')
      .map(Number);
    const [bMaj, bMin, bPat] = b.version
      .replace(/^v/, '')
      .split('.')
      .map(Number);
    if (bMaj !== aMaj) return bMaj - aMaj;
    if (bMin !== aMin) return bMin - aMin;
    return bPat - aPat;
  });

  const manifest: ReleaseManifest = {
    latest: sorted[0]?.version || '',
    versions: sorted.map((r) => r.version),
    generatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(CONTENT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`  ✅ Updated manifest (${manifest.versions.length} versions)`);
}

/**
 * Get existing versions from disk.
 */
function getExistingVersions(): Set<string> {
  if (!fs.existsSync(CONTENT_DIR)) {
    return new Set();
  }

  const dirs = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });
  return new Set(
    dirs
      .filter((d) => d.isDirectory() && d.name.startsWith('v'))
      .map((d) => d.name.slice(1)) // Remove 'v' prefix
  );
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  console.log('📦 Generating release content...\n');

  // Check CHANGELOG.md exists
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error('❌ CHANGELOG.md not found');
    console.log('   Create CHANGELOG.md following Keep a Changelog format');
    process.exit(1);
  }

  // Parse CHANGELOG.md
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const releases = parseChangelog(content);

  console.log(`📋 Found ${releases.length} release(s) in CHANGELOG.md`);
  if (verbose) {
    for (const r of releases) {
      console.log(`   - ${r.version} (${r.date}): ${r.changes.length} changes`);
    }
  }

  if (releases.length === 0) {
    console.log('\n⚠️  No releases found in CHANGELOG.md');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n🔍 Dry run - no files written');
    for (const release of releases) {
      console.log(`\n${release.version} (${release.date}):`);
      const grouped = groupByType(release.changes);
      for (const [type, changes] of Object.entries(grouped)) {
        console.log(
          `  ${TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type}:`
        );
        for (const change of changes!) {
          const scope = change.scope ? `(${change.scope}) ` : '';
          console.log(`    - ${scope}${change.description}`);
        }
      }
    }
    process.exit(0);
  }

  // Ensure content directory exists
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  // Determine which releases to process
  const existingVersions = getExistingVersions();
  const toProcess = force
    ? releases
    : releases.filter(
        (r) => !existingVersions.has(r.version.replace(/^v/, ''))
      );

  if (toProcess.length === 0) {
    console.log('\n✅ All releases already generated');
    writeManifest(releases);
    process.exit(0);
  }

  console.log(`\n🔄 Processing ${toProcess.length} release(s)...\n`);

  // Generate content for each release
  for (const release of toProcess) {
    console.log(`📝 Generating ${release.version}...`);
    const productNotes = await generateProductNotes(release);
    writeRelease(release, productNotes);
  }

  // Update manifest with all releases
  console.log('\n📄 Updating manifest...');
  writeManifest(releases);

  console.log('\n✨ Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
