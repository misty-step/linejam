/**
 * CHANGELOG.md parser.
 *
 * Parses Keep a Changelog format:
 * https://keepachangelog.com/en/1.1.0/
 *
 * Also handles conventional commit style bullets.
 */

import type { ChangelogEntry, ChangeType, Release } from './types';
import { SECTION_TO_TYPE } from './types';

/** Parse version header: ## [1.0.0] - 2024-01-15 */
const VERSION_REGEX = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/;

/** Parse section header: ### Added */
const SECTION_REGEX = /^###\s+(\w+)/;

/** Parse bullet point */
const BULLET_REGEX = /^[-*]\s+(.+)/;

/** Parse PR/commit reference: (#123) or (abc1234) */
const REF_REGEX = /\(#(\d+)\)|\(([a-f0-9]{7,40})\)/;

/** Parse conventional commit prefix: feat(scope): description */
const CONVENTIONAL_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/;

/**
 * Parse CHANGELOG.md content into structured releases.
 */
export function parseChangelog(content: string): Release[] {
  const lines = content.split('\n');
  const releases: Release[] = [];

  let currentRelease: Release | null = null;
  let currentSection: ChangeType | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Version header
    const versionMatch = trimmed.match(VERSION_REGEX);
    if (versionMatch) {
      if (currentRelease) {
        releases.push(currentRelease);
      }
      currentRelease = {
        version: versionMatch[1],
        date: versionMatch[2] || new Date().toISOString().split('T')[0],
        changes: [],
      };
      currentSection = null;
      continue;
    }

    // Section header (### Added, ### Fixed, etc.)
    const sectionMatch = trimmed.match(SECTION_REGEX);
    if (sectionMatch && currentRelease) {
      const sectionName = sectionMatch[1];
      currentSection = SECTION_TO_TYPE[sectionName] || 'chore';
      continue;
    }

    // Bullet point
    const bulletMatch = trimmed.match(BULLET_REGEX);
    if (bulletMatch && currentRelease) {
      const entry = parseBullet(bulletMatch[1], currentSection);
      if (entry) {
        currentRelease.changes.push(entry);
      }
    }
  }

  // Don't forget the last release
  if (currentRelease) {
    releases.push(currentRelease);
  }

  // Filter out "Unreleased" entries
  return releases.filter((r) => r.version.toLowerCase() !== 'unreleased');
}

/**
 * Parse a single bullet point into a ChangelogEntry.
 */
function parseBullet(
  text: string,
  sectionType: ChangeType | null
): ChangelogEntry | null {
  let type: ChangeType = sectionType || 'chore';
  let scope: string | undefined;
  let description = text;
  let breaking = false;
  let pr: number | undefined;
  let commit: string | undefined;

  // Extract PR/commit reference
  const refMatch = text.match(REF_REGEX);
  if (refMatch) {
    if (refMatch[1]) {
      pr = parseInt(refMatch[1], 10);
    }
    if (refMatch[2]) {
      commit = refMatch[2];
    }
    description = description.replace(REF_REGEX, '').trim();
  }

  // Try conventional commit format
  const conventionalMatch = description.match(CONVENTIONAL_REGEX);
  if (conventionalMatch) {
    type = (conventionalMatch[1] as ChangeType) || type;
    scope = conventionalMatch[2];
    breaking = !!conventionalMatch[3];
    description = conventionalMatch[4];
  } else {
    // Check for **BREAKING** prefix
    if (description.startsWith('**BREAKING**')) {
      breaking = true;
      description = description.replace('**BREAKING**', '').trim();
    }
    // Check for scope in brackets: [auth] description
    const bracketScope = description.match(/^\[([^\]]+)\]\s*(.+)/);
    if (bracketScope) {
      scope = bracketScope[1];
      description = bracketScope[2];
    }
  }

  // Clean up description
  description = description.replace(/\s+/g, ' ').trim();

  if (!description) {
    return null;
  }

  return {
    type,
    scope,
    description,
    breaking,
    pr,
    commit,
  };
}

/**
 * Find a specific release by version.
 */
export function findRelease(
  releases: Release[],
  version: string
): Release | undefined {
  // Normalize version (strip 'v' prefix if present)
  const normalized = version.replace(/^v/, '');
  return releases.find((r) => r.version.replace(/^v/, '') === normalized);
}
