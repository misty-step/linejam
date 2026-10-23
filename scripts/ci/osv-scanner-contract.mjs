#!/usr/bin/env node

// Offline contract between the pinned OSV-Scanner v2.0.2 and osv-audit.mjs.
//
// osv-audit.mjs gates on groups[].max_severity, which the scanner computes
// from each advisory's severity entries. The unit tests in
// tests/scripts/osv-audit.test.ts feed that field in directly. This contract
// runs the real scanner over local advisory fixtures
// (osv-scanner-contract/advisories.json) and pins both halves:
//
// 1. the scanner's normalized output for CVSS_V2/V3/V4 vectors, multiple and
//    aliased entries, database_specific.severity, absent or empty severity,
//    malformed vectors and non-CVSS types;
// 2. the unmodified gate's exit status and blocking lines for that output.
//
// It runs offline. The fixtures are packed into the scanner's local database
// layout (<dir>/osv-scanner/npm/all.zip), the scanner gets --offline and
// --offline-vulnerabilities, and every proxy variable points at a closed port
// so any network attempt fails instead of reaching osv.dev.
//
// Dagger's audit function runs this with the same scanner binary before the
// real audit. Locally: put osv-scanner v2.0.2 on PATH and run
// `node scripts/ci/osv-scanner-contract.mjs`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const auditScript = join(here, 'osv-audit.mjs');
const advisories = JSON.parse(
  readFileSync(join(here, 'osv-scanner-contract', 'advisories.json'), 'utf8')
);

// Scanner normalization, captured from OSV-Scanner v2.0.2. `ids` are sorted.
// An empty max_severity is the gate's UNKNOWN case.
const EXPECTED_GROUPS = {
  'osv-fixture-cvss-v2': [{ ids: ['FIXTURE-CVSS-V2'], max: '7.5' }],
  'osv-fixture-cvss-v3': [{ ids: ['FIXTURE-CVSS-V3'], max: '7.5' }],
  'osv-fixture-cvss-v4': [{ ids: ['FIXTURE-CVSS-V4'], max: '9.3' }],
  'osv-fixture-cvss-v3-low': [{ ids: ['FIXTURE-CVSS-V3-LOW'], max: '1.8' }],
  'osv-fixture-cvss-v4-medium': [
    { ids: ['FIXTURE-CVSS-V4-MEDIUM'], max: '5.3' },
  ],
  // The highest calculable entry wins.
  'osv-fixture-multiple-severities': [
    { ids: ['FIXTURE-MULTIPLE-SEVERITIES'], max: '9.3' },
  ],
  // Advisories sharing an alias form one group scored by its highest member.
  'osv-fixture-aliased-pair': [
    { ids: ['FIXTURE-ALIAS-HIGH', 'FIXTURE-ALIAS-LOW'], max: '7.5' },
  ],
  // database_specific.severity is never read: alone it is UNKNOWN...
  'osv-fixture-database-specific-only': [
    { ids: ['FIXTURE-DATABASE-SPECIFIC-ONLY'], max: '' },
  ],
  // ...and beside a CVSS vector the vector decides, even when the label is
  // CRITICAL and the vector scores low.
  'osv-fixture-database-specific-and-low-cvss': [
    { ids: ['FIXTURE-DATABASE-SPECIFIC-AND-LOW-CVSS'], max: '1.8' },
  ],
  'osv-fixture-severity-absent': [
    { ids: ['FIXTURE-SEVERITY-ABSENT'], max: '' },
  ],
  'osv-fixture-severity-empty': [{ ids: ['FIXTURE-SEVERITY-EMPTY'], max: '' }],
  'osv-fixture-malformed-v3': [{ ids: ['FIXTURE-MALFORMED-V3'], max: '' }],
  'osv-fixture-malformed-v4': [{ ids: ['FIXTURE-MALFORMED-V4'], max: '' }],
  // One malformed entry makes the whole group UNKNOWN, even beside a valid
  // vector.
  'osv-fixture-malformed-and-valid-v2': [
    { ids: ['FIXTURE-MALFORMED-AND-VALID-V2'], max: '' },
  ],
  'osv-fixture-bare-numeric-score': [
    { ids: ['FIXTURE-BARE-NUMERIC-SCORE'], max: '' },
  ],
  'osv-fixture-v4-vector-labelled-v3': [
    { ids: ['FIXTURE-V4-VECTOR-LABELLED-V3'], max: '' },
  ],
  'osv-fixture-non-cvss-type': [{ ids: ['FIXTURE-NON-CVSS-TYPE'], max: '' }],
  'osv-fixture-clean': [],
};

const BLOCKING_GATE_LINES = [
  'Blocking advisory: CRITICAL 9.3 osv-fixture-cvss-v4@1.0.0: FIXTURE-CVSS-V4',
  'Blocking advisory: CRITICAL 9.3 osv-fixture-multiple-severities@1.0.0: FIXTURE-MULTIPLE-SEVERITIES',
  'Blocking advisory: HIGH 7.5 osv-fixture-aliased-pair@1.0.0: FIXTURE-ALIAS-HIGH, FIXTURE-ALIAS-LOW',
  'Blocking advisory: HIGH 7.5 osv-fixture-cvss-v2@1.0.0: FIXTURE-CVSS-V2',
  'Blocking advisory: HIGH 7.5 osv-fixture-cvss-v3@1.0.0: FIXTURE-CVSS-V3',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-bare-numeric-score@1.0.0: FIXTURE-BARE-NUMERIC-SCORE',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-database-specific-only@1.0.0: FIXTURE-DATABASE-SPECIFIC-ONLY',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-malformed-and-valid-v2@1.0.0: FIXTURE-MALFORMED-AND-VALID-V2',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-malformed-v3@1.0.0: FIXTURE-MALFORMED-V3',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-malformed-v4@1.0.0: FIXTURE-MALFORMED-V4',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-non-cvss-type@1.0.0: FIXTURE-NON-CVSS-TYPE',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-severity-absent@1.0.0: FIXTURE-SEVERITY-ABSENT',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-severity-empty@1.0.0: FIXTURE-SEVERITY-EMPTY',
  'Blocking advisory: UNKNOWN (no CVSS score) osv-fixture-v4-vector-labelled-v3@1.0.0: FIXTURE-V4-VECTOR-LABELLED-V3',
];

// Each scenario is one fixture project; the gate result is for that project.
const SCENARIOS = [
  {
    name: 'every severity shape',
    packages: Object.keys(EXPECTED_GROUPS),
    scannerStatus: 1,
    gateStatus: 1,
    gateStderr: BLOCKING_GATE_LINES,
    gateStdout: [
      'OSV scanned 18 packages and 17 advisory groups; 14 blocking HIGH/CRITICAL/UNKNOWN groups.',
    ],
  },
  {
    name: 'only known scores below 7.0',
    packages: [
      'osv-fixture-cvss-v3-low',
      'osv-fixture-cvss-v4-medium',
      'osv-fixture-database-specific-and-low-cvss',
      'osv-fixture-clean',
    ],
    scannerStatus: 1,
    gateStatus: 0,
    gateStderr: [],
    gateStdout: [
      'OSV scanned 4 packages and 3 advisory groups; 0 blocking HIGH/CRITICAL/UNKNOWN groups.',
      'No blocking HIGH/CRITICAL/UNKNOWN advisories; known CVSS scores below 7.0 do not fail the gate.',
    ],
  },
  {
    name: 'no advisories',
    packages: ['osv-fixture-clean'],
    scannerStatus: 0,
    gateStatus: 0,
    gateStderr: [],
    gateStdout: [
      'OSV scanned 1 packages and 0 advisory groups; 0 blocking HIGH/CRITICAL/UNKNOWN groups.',
      'No blocking HIGH/CRITICAL/UNKNOWN advisories; known CVSS scores below 7.0 do not fail the gate.',
    ],
  },
];

// Same arguments as osv-audit.mjs, plus the offline switches.
const AUDIT_ARGS = [
  'scan',
  'source',
  '--lockfile=pnpm-lock.yaml',
  '--format=json',
  '--verbosity=error',
  '--all-packages',
  '--no-call-analysis=all',
];
const OFFLINE_ARGS = ['--offline', '--offline-vulnerabilities'];
const CLOSED_PROXY = 'http://127.0.0.1:9';

function findOnPath(command) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (directory === '') continue;
    const candidate = join(directory, command);
    try {
      accessSync(candidate, constants.X_OK);
      return resolve(candidate);
    } catch {
      // Not in this PATH entry.
    }
  }
  throw new Error(`${command} is not on PATH.`);
}

// Minimal stored (uncompressed) zip writer for the scanner's local database.
function writeZip(path, files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12); // 1980-01-01
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(path, Buffer.concat([...locals, directory, end]));
}

function writeLockfile(directory, packages) {
  const lines = [
    "lockfileVersion: '9.0'",
    '',
    'settings:',
    '  autoInstallPeers: true',
    '  excludeLinksFromLockfile: false',
    '',
    'importers:',
    '',
    '  .:',
    '    dependencies:',
    ...packages.flatMap((name) => [
      `      ${name}:`,
      '        specifier: 1.0.0',
      '        version: 1.0.0',
    ]),
    '',
    'packages:',
    '',
    ...packages.flatMap((name) => [
      `  ${name}@1.0.0:`,
      '    resolution: {integrity: sha512-AAAA}',
      '',
    ]),
    'snapshots:',
    '',
    ...packages.flatMap((name) => [`  ${name}@1.0.0: {}`, '']),
  ];
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'pnpm-lock.yaml'), lines.join('\n'));
}

function lines(text) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '');
}

function main() {
  const scanner = findOnPath('osv-scanner');
  const version = spawnSync(scanner, ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, 'osv-scanner --version failed');
  assert.match(
    version.stdout,
    /^osv-scanner version: 2\.0\.2$/m,
    'The contract is pinned to OSV-Scanner v2.0.2.'
  );

  const workspace = mkdtempSync(join(tmpdir(), 'linejam-osv-contract-'));
  try {
    const database = join(workspace, 'db');
    mkdirSync(join(database, 'osv-scanner', 'npm'), { recursive: true });
    writeZip(
      join(database, 'osv-scanner', 'npm', 'all.zip'),
      advisories.map((advisory) => [
        `${advisory.id}.json`,
        JSON.stringify(advisory),
      ])
    );

    // osv-audit.mjs spawns `osv-scanner` from PATH; this wrapper adds only
    // the offline switches in front of the pinned binary.
    const wrapperDirectory = join(workspace, 'bin');
    mkdirSync(wrapperDirectory);
    writeFileSync(
      join(wrapperDirectory, 'osv-scanner'),
      `#!/bin/sh\nexec "$OSV_CONTRACT_SCANNER" "$@" ${OFFLINE_ARGS.join(' ')}\n`,
      { mode: 0o755 }
    );

    const env = {
      ...process.env,
      HOME: workspace,
      OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY: database,
      OSV_CONTRACT_SCANNER: scanner,
      HTTP_PROXY: CLOSED_PROXY,
      HTTPS_PROXY: CLOSED_PROXY,
      ALL_PROXY: CLOSED_PROXY,
      http_proxy: CLOSED_PROXY,
      https_proxy: CLOSED_PROXY,
      all_proxy: CLOSED_PROXY,
      NO_PROXY: '',
      no_proxy: '',
    };

    SCENARIOS.forEach((scenario, index) => {
      const project = join(workspace, `project-${index}`);
      writeLockfile(project, scenario.packages);

      const scan = spawnSync(scanner, [...AUDIT_ARGS, ...OFFLINE_ARGS], {
        cwd: project,
        env,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.equal(scan.stderr, '', `${scenario.name}: scanner stderr`);
      assert.equal(
        scan.status,
        scenario.scannerStatus,
        `${scenario.name}: scanner exit status`
      );
      const report = JSON.parse(scan.stdout);
      assert.equal(report.results.length, 1, `${scenario.name}: one source`);
      const actual = Object.fromEntries(
        report.results[0].packages.map((entry) => [
          entry.package.name,
          (entry.groups ?? []).map((group) => ({
            ids: [...group.ids].sort(),
            max: group.max_severity,
          })),
        ])
      );
      const expected = Object.fromEntries(
        scenario.packages.map((name) => [name, EXPECTED_GROUPS[name]])
      );
      assert.deepEqual(
        actual,
        expected,
        `${scenario.name}: scanner max_severity normalization`
      );

      const gate = spawnSync(process.execPath, [auditScript], {
        cwd: project,
        env: {
          ...env,
          PATH: `${wrapperDirectory}${delimiter}${process.env.PATH ?? ''}`,
        },
        encoding: 'utf8',
      });
      assert.equal(
        gate.status,
        scenario.gateStatus,
        `${scenario.name}: gate exit status\n${gate.stdout}${gate.stderr}`
      );
      assert.deepEqual(
        lines(gate.stderr).sort(),
        [...scenario.gateStderr].sort(),
        `${scenario.name}: gate blocking advisories`
      );
      assert.deepEqual(
        lines(gate.stdout),
        scenario.gateStdout,
        `${scenario.name}: gate summary`
      );
      console.log(
        `OSV contract: ${scenario.name}: scanner exit ${scan.status}, gate exit ${gate.status}, ${scenario.gateStderr.length} blocking.`
      );
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
  console.log(
    `OSV contract passed: ${advisories.length} offline advisory fixtures, ${SCENARIOS.length} scenarios, OSV-Scanner v2.0.2.`
  );
}

try {
  main();
} catch (error) {
  console.error(`OSV scanner contract failed: ${error.message}`);
  process.exitCode = 1;
}
