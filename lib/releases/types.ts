/**
 * Release notes infrastructure types.
 *
 * Static file-based releases for private repos.
 * CHANGELOG.md → Parser → LLM synthesis → Static files → Page rendering
 */

/** Conventional commit change types */
export type ChangeType =
  | 'feat'
  | 'fix'
  | 'perf'
  | 'refactor'
  | 'docs'
  | 'chore'
  | 'style'
  | 'test'
  | 'build'
  | 'ci';

/** A single changelog entry from CHANGELOG.md */
export interface ChangelogEntry {
  type: ChangeType;
  scope?: string;
  description: string;
  pr?: number;
  commit?: string;
  breaking: boolean;
}

/** A parsed release from CHANGELOG.md */
export interface Release {
  version: string;
  date: string;
  changes: ChangelogEntry[];
  compareUrl?: string;
}

/** A release with LLM-generated product notes */
export interface ReleaseWithNotes extends Release {
  /** LLM-generated user-friendly summary */
  productNotes: string;
}

/** Manifest tracking all generated releases */
export interface ReleaseManifest {
  latest: string;
  versions: string[];
  generatedAt: string;
}

/** Mapping from Keep a Changelog section headers to change types */
export const SECTION_TO_TYPE: Record<string, ChangeType> = {
  Added: 'feat',
  Changed: 'refactor',
  Deprecated: 'chore',
  Removed: 'chore',
  Fixed: 'fix',
  Security: 'fix',
  Performance: 'perf',
};

/** Reverse mapping for display */
export const TYPE_LABELS: Record<ChangeType, string> = {
  feat: 'New Features',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Changes',
  docs: 'Documentation',
  chore: 'Maintenance',
  style: 'Styling',
  test: 'Testing',
  build: 'Build',
  ci: 'CI/CD',
};
