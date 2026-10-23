#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Contract pinned with the Dagger image to OSV-Scanner v2.0.2:
// https://github.com/google/osv-scanner/blob/v2.0.2/pkg/models/results.go
// https://github.com/google/osv-scanner/blob/v2.0.2/internal/output/table.go
// groups[].max_severity is a computed CVSS score string, not a severity label.
// The scanner ignores database_specific.severity when computing it, so the gate
// reads that label from each grouped vulnerability and blocks on the worse of
// the two: a CRITICAL label beside a vector scoring 1.8 is CRITICAL.
// https://github.com/google/osv-scanner/blob/v2.0.2/docs/output.md#return-codes
// Exit 1 means findings, but can coexist with a partial API failure. Error-level
// stderr must also be empty: cmd/osv-scanner/internal/cmd/run.go returns findings before
// checking HasErrored(), including errors from makeVulnRequestWithMatcher().

function assertObject(value, label) {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw new Error(`${label} must be an object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
}

function assertString(value, label) {
  if (
    Object.prototype.toString.call(value) !== '[object String]' ||
    value.trim() === ''
  ) {
    throw new Error(`${label} must be a nonempty string.`);
  }
}

// FIRST qualitative scale for scores; GHSA labels for database_specific.
const RANK = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
const LABELS = new Set(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']);

function scoreRating(score) {
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MODERATE';
  return score > 0 ? 'LOW' : 'NONE';
}

// Returns the vulnerability's database_specific.severity label, or null when it
// has none. Any other shape is an unrecognized schema and fails closed.
function severityLabel(vulnerability, label) {
  const specific = vulnerability.database_specific;
  if (specific === undefined) return null;
  assertObject(specific, `${label} database_specific`);
  if (specific.severity === undefined) return null;
  if (!LABELS.has(specific.severity)) {
    throw new Error(`Unclassifiable severity label for ${label}.`);
  }
  return specific.severity;
}

function classifyResults(report, scannerStatus) {
  assertObject(report, 'OSV report');
  assertArray(report.results, 'OSV results');
  // --all-packages makes an empty scan distinguishable from a clean lockfile.
  if (report.results.length !== 1) {
    throw new Error('Expected exactly one scanned pnpm-lock.yaml source.');
  }

  const source = report.results[0];
  assertObject(source, 'OSV source result');
  assertObject(source.source, 'OSV source');
  assertString(source.source.path, 'OSV source path');
  if (
    source.source.type !== 'lockfile' ||
    resolve(source.source.path) !== resolve('pnpm-lock.yaml')
  ) {
    throw new Error(
      'OSV results do not describe the requested pnpm-lock.yaml.'
    );
  }
  assertArray(source.packages, 'OSV packages');
  if (source.packages.length === 0) {
    throw new Error('OSV scanned no packages.');
  }

  let groupsScanned = 0;
  const blocked = [];
  for (const entry of source.packages) {
    assertObject(entry, 'OSV package result');
    assertObject(entry.package, 'OSV package');
    const pkg = entry.package;
    assertString(pkg.name, 'OSV package name');
    assertString(pkg.version, 'OSV package version');
    if (pkg.ecosystem !== 'npm') {
      throw new Error(`Unexpected pnpm package ecosystem for ${pkg.name}.`);
    }

    const vulnerabilities = entry.vulnerabilities ?? [];
    const groups = entry.groups ?? [];
    // v2.0.2 omits these fields when empty; explicit null is not that schema.
    if (entry.vulnerabilities === null || entry.groups === null) {
      throw new Error(`Invalid vulnerability arrays for ${pkg.name}.`);
    }
    assertArray(vulnerabilities, `${pkg.name} vulnerabilities`);
    assertArray(groups, `${pkg.name} groups`);
    const unclassified = new Map();
    for (const vulnerability of vulnerabilities) {
      assertObject(vulnerability, `${pkg.name} vulnerability`);
      assertString(vulnerability.id, `${pkg.name} vulnerability ID`);
      if (unclassified.has(vulnerability.id)) {
        throw new Error(`Duplicate vulnerability ID ${vulnerability.id}.`);
      }
      const severity = vulnerability.severity ?? [];
      assertArray(severity, `${vulnerability.id} severity`);
      unclassified.set(vulnerability.id, {
        hasVectors: severity.length > 0,
        label: severityLabel(vulnerability, vulnerability.id),
      });
    }

    for (const group of groups) {
      assertObject(group, `${pkg.name} group`);
      assertArray(group.ids, `${pkg.name} group IDs`);
      if (group.ids.length === 0) {
        throw new Error(`Empty vulnerability group for ${pkg.name}.`);
      }
      let label = null;
      let hasVectors = false;
      for (const id of group.ids) {
        assertString(id, `${pkg.name} group ID`);
        const member = unclassified.get(id);
        if (!member) {
          throw new Error(
            `Unmatched or repeated vulnerability group ID ${id}.`
          );
        }
        unclassified.delete(id);
        hasVectors ||= member.hasVectors;
        if (member.label && (!label || RANK[member.label] > RANK[label])) {
          label = member.label;
        }
      }

      // MaxSeverity formats one decimal place, or "" when no CVSS can be
      // calculated. Any other non-score value means an incompatible scanner
      // schema and fails closed.
      if (
        Object.prototype.toString.call(group.max_severity) !== '[object String]'
      ) {
        throw new Error(`${pkg.name} CVSS score must be a string.`);
      }
      groupsScanned += 1;
      const advisory = `${pkg.name}@${pkg.version}: ${group.ids.join(', ')}`;
      // An empty score with no label, or with severity vectors the scanner
      // could not score, is UNKNOWN and always blocks: a label never stands in
      // for an unscorable vector, nothing is treated as low, and there is no
      // exception path.
      if (group.max_severity === '') {
        if (hasVectors || !label) {
          blocked.push(`UNKNOWN (no CVSS score) ${advisory}`);
        } else if (RANK[label] >= RANK.HIGH) {
          blocked.push(`${label} (severity label; no CVSS score) ${advisory}`);
        }
        continue;
      }
      if (!/^(?:[0-9]\.[0-9]|10\.0)$/.test(group.max_severity)) {
        throw new Error(
          `Unclassifiable CVSS score for ${pkg.name}: ${group.ids.join(', ')}.`
        );
      }
      // The worse of the CVSS rating and the label decides.
      const rating = scoreRating(Number(group.max_severity));
      if (label && RANK[label] > RANK[rating]) {
        if (RANK[label] >= RANK.HIGH) {
          blocked.push(
            `${label} (severity label; CVSS ${group.max_severity}) ${advisory}`
          );
        }
      } else if (RANK[rating] >= RANK.HIGH) {
        blocked.push(`${rating} ${group.max_severity} ${advisory}`);
      }
    }
    if (unclassified.size > 0) {
      throw new Error(
        `Ungrouped vulnerabilities for ${pkg.name}: ${[...unclassified.keys()].join(', ')}.`
      );
    }
  }

  // This command disables call analysis and does not scan licenses. The CLI
  // findings code and the complete vulnerability groups must agree.
  if ((scannerStatus === 1) !== groupsScanned > 0) {
    throw new Error('OSV exit status and vulnerability results disagree.');
  }
  return { packagesScanned: source.packages.length, groupsScanned, blocked };
}

function main() {
  const scan = spawnSync(
    'osv-scanner',
    [
      'scan',
      'source',
      '--lockfile=pnpm-lock.yaml',
      '--format=json',
      '--verbosity=error',
      '--all-packages',
      '--no-call-analysis=all',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

  if (scan.stderr) process.stderr.write(scan.stderr);
  if (scan.error) throw scan.error;
  if (scan.signal || (scan.status !== 0 && scan.status !== 1)) {
    throw new Error(
      `OSV scanner did not complete (status ${scan.status}, signal ${scan.signal ?? 'none'}).`
    );
  }
  if (scan.stderr.trim() !== '') {
    throw new Error('OSV scanner reported errors; refusing partial results.');
  }

  const { packagesScanned, groupsScanned, blocked } = classifyResults(
    JSON.parse(scan.stdout),
    scan.status
  );
  for (const finding of blocked) console.error(`Blocking advisory: ${finding}`);
  console.log(
    `OSV scanned ${packagesScanned} packages and ${groupsScanned} advisory groups; ${blocked.length} blocking HIGH/CRITICAL/UNKNOWN groups.`
  );
  if (blocked.length > 0) return 1;
  console.log(
    'No blocking HIGH/CRITICAL/UNKNOWN advisories; known CVSS scores below 7.0 with no HIGH/CRITICAL label do not fail the gate.'
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`OSV audit failed closed: ${error.message}`);
  process.exitCode = 2;
}
