import Ajv from 'ajv/dist/2020';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION } from '../appVersion';
import { isReleaseDate, isReleaseVersion, parseChangelog } from './parser';
import landmarkEntrySchema from './release-entry.schema.json';
import {
  TYPE_LABELS,
  type JsonValue,
  type LandmarkReleaseEntry,
  type Release,
  type ReleaseCatalog,
  type ReleaseDiagnostic,
  type ReleaseManifest,
  type ReleaseWithNotes,
} from './types';

const ajv = new Ajv().addKeyword('x-landmark-artifact');
const isVersionRecord = ajv.compile<{ version: string }>({
  type: 'object',
  required: ['version'],
  properties: { version: { type: 'string' } },
});
const isSynthesisStatus = ajv.compile<{ quality: 'valid' | 'skipped' }>({
  type: 'object',
  required: ['quality'],
  properties: { quality: { enum: ['valid', 'skipped'] } },
  additionalProperties: false,
});
const isReleaseRecord = ajv.compile<Release>({
  type: 'object',
  required: ['version', 'date', 'changes'],
  properties: {
    version: { type: 'string' },
    date: { type: 'string' },
    compareUrl: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'description', 'breaking'],
        properties: {
          type: { enum: Object.keys(TYPE_LABELS) },
          description: { type: 'string' },
          breaking: { type: 'boolean' },
          scope: { type: 'string' },
          commit: { type: 'string' },
          pr: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
});
const isLandmarkRecord = ajv.compile<LandmarkReleaseEntry>(landmarkEntrySchema);
const isLegacyArchive = ajv.compile<{
  releases: { version: string; html: string; plaintext: string }[];
}>({
  type: 'object',
  required: ['schemaVersion', 'source', 'sourceSha256', 'releases'],
  properties: {
    schemaVersion: { const: 1 },
    source: { type: 'string' },
    sourceSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    releases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['version', 'html', 'plaintext'],
        properties: {
          version: { type: 'string' },
          html: { type: 'string' },
          plaintext: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
});

export function readJson(filename: string): JsonValue {
  const parsed: JsonValue = JSON.parse(fs.readFileSync(filename, 'utf8'));
  return parsed;
}

function isLandmarkEntry(
  value: JsonValue
): value is JsonValue & LandmarkReleaseEntry {
  return (
    isLandmarkRecord(value) &&
    value.schema_version === 'landmark.public-release-notes.v1' &&
    isReleaseVersion(value.version) &&
    value.tag === `v${value.version}` &&
    value.repository === 'misty-step/linejam' &&
    value.audience === 'end-user' &&
    value.markdown.trim().length > 0 &&
    value.notes === value.markdown &&
    value.plaintext.trim().length > 0 &&
    !Number.isNaN(Date.parse(value.published_at))
  );
}

/** Read only checked-in sources; neither builds nor Pages synthesize notes. */
export function readReleaseSources(root = process.cwd()): ReleaseCatalog {
  const directory = path.join(root, 'content/releases');
  const diagnostics: ReleaseDiagnostic[] = [];
  const report = (severity: ReleaseDiagnostic['severity'], message: string) => {
    diagnostics.push({ severity, message });
  };
  const pkg = readJson(path.join(root, 'package.json'));
  if (!isVersionRecord(pkg) || !isReleaseVersion(pkg.version)) {
    throw new Error('package.json must contain a semantic release version.');
  }
  const currentVersion = pkg.version;
  let releases: Release[] = [];
  try {
    releases = parseChangelog(
      fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    );
  } catch (error) {
    report('error', `CHANGELOG.md could not be read: ${String(error)}`);
  }
  if (releases[0]?.version !== currentVersion) {
    report(
      'error',
      `Package version ${currentVersion} does not match the first CHANGELOG.md release (${releases[0]?.version || 'missing'}).`
    );
  }

  const byVersion = new Map<string, Release>();
  for (const release of releases) {
    if (byVersion.has(release.version)) {
      report('error', `Duplicate CHANGELOG.md release ${release.version}.`);
    } else {
      byVersion.set(release.version, release);
    }
  }
  // Keep legitimate archive entries even when a later changelog dropped them.
  if (fs.existsSync(directory)) {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || !entry.name.startsWith('v')) continue;
      const version = entry.name.slice(1);
      if (!isReleaseVersion(version)) {
        report('error', `Unrecognized release directory ${entry.name}.`);
        continue;
      }
      if (byVersion.has(version)) continue;
      try {
        const archived = readJson(
          path.join(directory, entry.name, 'changelog.json')
        );
        if (
          !isReleaseRecord(archived) ||
          archived.version !== version ||
          !isReleaseDate(archived.date)
        )
          throw new Error('invalid archive record');
        byVersion.set(version, archived);
        report(
          'warning',
          `Archived v${version} is retained but absent from CHANGELOG.md.`
        );
      } catch {
        report(
          'error',
          `Archived v${version} has missing or malformed changelog.json.`
        );
      }
    }
  }

  const landmark = new Map<string, LandmarkReleaseEntry>();
  const invalidNotes = new Set<string>();
  const landmarkPath = path.join(directory, 'landmark.json');
  if (fs.existsSync(landmarkPath)) {
    try {
      const entries = readJson(landmarkPath);
      if (!Array.isArray(entries))
        throw new Error('expected a release-entry JSON array');
      for (const entry of entries) {
        if (!isLandmarkEntry(entry) || landmark.has(entry.version)) {
          const version = isVersionRecord(entry) ? entry.version : 'unknown';
          invalidNotes.add(version);
          report(
            'error',
            `Malformed or duplicate Landmark notes for ${version}.`
          );
          continue;
        }
        landmark.set(entry.version, entry);
        if (!byVersion.has(entry.version)) {
          report(
            'error',
            `Landmark notes for v${entry.version} have no released changelog entry.`
          );
        }
      }
    } catch (error) {
      report('error', `Landmark notes could not be read: ${String(error)}`);
    }
  }

  const legacyNotes = new Map<string, string>();
  const legacyPath = path.join(directory, 'legacy-notes.json');
  if (fs.existsSync(legacyPath)) {
    try {
      const archive = readJson(legacyPath);
      if (!isLegacyArchive(archive)) throw new Error('invalid archive schema');
      for (const entry of archive.releases) {
        if (
          !isReleaseVersion(entry.version) ||
          legacyNotes.has(entry.version) ||
          !byVersion.has(entry.version)
        ) {
          throw new Error(
            `invalid, duplicate, or unrecorded archived version ${entry.version}`
          );
        }
        legacyNotes.set(entry.version, entry.plaintext);
      }
    } catch (error) {
      report(
        'error',
        `Legacy public notes could not be read: ${String(error)}`
      );
    }
  }

  const withNotes: ReleaseWithNotes[] = [];
  for (const release of byVersion.values()) {
    const versionDirectory = path.join(directory, `v${release.version}`);
    const notesPath = path.join(versionDirectory, 'notes.md');
    const statusPath = path.join(versionDirectory, 'synthesis.json');
    const entry = landmark.get(release.version);
    const legacy = legacyNotes.get(release.version);
    let notesStatus: ReleaseWithNotes['notesStatus'] = 'missing';
    let productNotes = '';
    try {
      const status = fs.existsSync(statusPath)
        ? readJson(statusPath)
        : undefined;
      if (status !== undefined && !isSynthesisStatus(status)) {
        throw new Error(
          'synthesis did not produce valid or policy-skipped notes'
        );
      }
      if (invalidNotes.has(release.version))
        throw new Error('malformed Landmark entry');
      if (isSynthesisStatus(status) && status.quality === 'skipped') {
        if (entry || fs.existsSync(notesPath))
          throw new Error('skipped synthesis still has public notes');
        notesStatus = 'skipped';
      } else if (entry) {
        if (
          fs.readFileSync(notesPath, 'utf8').trim() !== entry.markdown.trim()
        ) {
          throw new Error('Landmark JSON and markdown disagree');
        }
        notesStatus = 'landmark';
        productNotes = entry.plaintext.trim();
      } else if (status !== undefined) {
        throw new Error('valid synthesis is missing its Landmark JSON entry');
      } else if (legacy) {
        notesStatus = 'legacy';
        productNotes = legacy;
      } else if (fs.existsSync(notesPath)) {
        productNotes = fs.readFileSync(notesPath, 'utf8').trim();
        if (productNotes) notesStatus = 'legacy';
      }
    } catch (error) {
      report(
        'error',
        `Public notes for v${release.version} are unavailable: ${String(error)}`
      );
    }
    if (notesStatus === 'missing' || notesStatus === 'skipped') {
      report(
        'warning',
        `v${release.version}: public notes ${notesStatus === 'skipped' ? 'were skipped by Landmark policy' : 'are not recorded'}. Technical history is retained.`
      );
    }
    withNotes.push({ ...release, productNotes, notesStatus });
  }
  // Dates define chronology across the historical v1.x -> v0.x release-line reset.
  // Stable sorting preserves CHANGELOG order for releases on the same date.
  withNotes.sort((a, b) => b.date.localeCompare(a.date));
  return { currentVersion, releases: withNotes, diagnostics };
}

export function releaseManifest(catalog: ReleaseCatalog): ReleaseManifest {
  return {
    schemaVersion: 2,
    currentVersion: catalog.currentVersion,
    versions: catalog.releases.map((release) => release.version),
    notes: Object.fromEntries(
      catalog.releases.map((release) => [release.version, release.notesStatus])
    ),
  };
}

/** A stale index is visible, but can never override package/CHANGELOG authority. */
export function loadReleaseCatalog(root = process.cwd()): ReleaseCatalog {
  const catalog = readReleaseSources(root);
  if (root === process.cwd() && catalog.currentVersion !== APP_VERSION) {
    catalog.diagnostics.push({
      severity: 'error',
      message: `Compiled application version ${APP_VERSION} differs from package.json (${catalog.currentVersion}).`,
    });
    catalog.currentVersion = APP_VERSION;
  }
  try {
    const stored = readJson(path.join(root, 'content/releases/manifest.json'));
    if (JSON.stringify(stored) !== JSON.stringify(releaseManifest(catalog))) {
      throw new Error('index differs from release sources');
    }
  } catch {
    catalog.diagnostics.push({
      severity: 'error',
      message:
        'The release index is missing, malformed, or out of sync. Run pnpm generate:releases.',
    });
  }
  return catalog;
}
