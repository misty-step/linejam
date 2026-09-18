#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Contract pinned with the Dagger image to OSV-Scanner v2.0.2:
// https://github.com/google/osv-scanner/blob/v2.0.2/pkg/models/results.go
// https://github.com/google/osv-scanner/blob/v2.0.2/internal/output/table.go
// groups[].max_severity is a computed CVSS score string, not a severity label.
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
    const unclassified = new Set();
    for (const vulnerability of vulnerabilities) {
      assertObject(vulnerability, `${pkg.name} vulnerability`);
      assertString(vulnerability.id, `${pkg.name} vulnerability ID`);
      if (unclassified.has(vulnerability.id)) {
        throw new Error(`Duplicate vulnerability ID ${vulnerability.id}.`);
      }
      unclassified.add(vulnerability.id);
    }

    for (const group of groups) {
      assertObject(group, `${pkg.name} group`);
      assertArray(group.ids, `${pkg.name} group IDs`);
      if (group.ids.length === 0) {
        throw new Error(`Empty vulnerability group for ${pkg.name}.`);
      }
      for (const id of group.ids) {
        assertString(id, `${pkg.name} group ID`);
        if (!unclassified.delete(id)) {
          throw new Error(
            `Unmatched or repeated vulnerability group ID ${id}.`
          );
        }
      }

      // MaxSeverity formats one decimal place, or "" when no CVSS can be
      // calculated. Reject unknown/malformed scores rather than treating them
      // as low; the scanner owns CVSS v2/v3/v4 calculation and alias grouping.
      assertString(group.max_severity, `${pkg.name} CVSS score`);
      if (!/^(?:[0-9]\.[0-9]|10\.0)$/.test(group.max_severity)) {
        throw new Error(
          `Unclassifiable CVSS score for ${pkg.name}: ${group.ids.join(', ')}.`
        );
      }
      const score = Number(group.max_severity);
      groupsScanned += 1;
      if (score >= 7) {
        const rating = score >= 9 ? 'CRITICAL' : 'HIGH';
        blocked.push(
          `${rating} ${group.max_severity} ${pkg.name}@${pkg.version}: ${group.ids.join(', ')}`
        );
      }
    }
    if (unclassified.size > 0) {
      throw new Error(
        `Ungrouped vulnerabilities for ${pkg.name}: ${[...unclassified].join(', ')}.`
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
  for (const finding of blocked) console.error(finding);
  console.log(
    `OSV scanned ${packagesScanned} packages and ${groupsScanned} advisory groups; ${blocked.length} HIGH/CRITICAL groups.`
  );
  if (blocked.length > 0) return 1;
  console.log(
    'No HIGH/CRITICAL advisories; known CVSS scores below 7.0 do not fail the gate.'
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`OSV audit failed closed: ${error.message}`);
  process.exitCode = 2;
}
