/**
 * Landmark owns release decisions and public notes. Linejam projects its
 * checked-in artifacts without contacting a provider during builds.
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

export type NotesStatus = 'landmark' | 'legacy' | 'missing' | 'skipped';

export const NOTES_STATUS_LABELS = {
  landmark: 'Release notes by Landmark.',
  legacy: 'Archived notes from the previous release pipeline.',
  missing:
    'Public notes are not recorded for this release. Technical history is available below.',
  skipped:
    'Landmark skipped public notes for this release. Technical history is available below.',
} satisfies Record<NotesStatus, string>;

/** Anything a checked-in JSON source may hold before it is validated. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A release with public notes, or an explicit absence of public notes. */
export interface ReleaseWithNotes extends Release {
  productNotes: string;
  notesStatus: NotesStatus;
}

export interface ReleaseDiagnostic {
  severity: 'warning' | 'error';
  message: string;
}

export interface ReleaseCatalog {
  currentVersion: string;
  releases: ReleaseWithNotes[];
  diagnostics: ReleaseDiagnostic[];
}

/** Deterministic index, never an independent version authority. */
export interface ReleaseManifest {
  schemaVersion: 2;
  currentVersion: string;
  versions: string[];
  notes: Record<string, NotesStatus>;
}

/** Consumed fields of Landmark's release-entry.v1.schema.json contract. */
export interface LandmarkReleaseEntry {
  schema_version: 'landmark.public-release-notes.v1';
  version: string;
  tag: string;
  repository: string;
  audience: string;
  notes: string;
  markdown: string;
  plaintext: string;
  html: string;
  slack: string;
  sections: {
    title: string;
    bullets: { text: string; links: { label: string; href: string }[] }[];
  }[];
  published_at: string;
}

/** Mapping from Keep a Changelog section headers to change types */
export const SECTION_TO_TYPE = {
  Added: 'feat',
  Features: 'feat',
  Changed: 'refactor',
  Deprecated: 'chore',
  Removed: 'chore',
  Fixed: 'fix',
  'Bug Fixes': 'fix',
  Security: 'fix',
  Performance: 'perf',
} satisfies Record<string, ChangeType>;

/** Reverse mapping for display */
export const TYPE_LABELS = {
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
} satisfies Record<ChangeType, string>;
