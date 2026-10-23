import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const auditScript = resolve('scripts/ci/osv-audit.mjs');
const workspaces: string[] = [];

// Fixture shape follows v2.0.2 pkg/models/results.go. Scores here exercise the
// gate boundary, not a second implementation of the scanner's CVSS calculator;
// labels exercise the gate's own read of database_specific.severity.
// How the real scanner turns CVSS_V2/V3/V4, database_specific.severity and
// absent or malformed severities into max_severity is pinned separately by
// scripts/ci/osv-scanner-contract.mjs, which runs OSV-Scanner v2.0.2 offline
// over local advisory fixtures in Dagger's audit step.
type Vulnerability = {
  id: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity: string | number };
};

function report(scores: string[] = []) {
  return {
    results: [
      {
        source: { path: 'pnpm-lock.yaml', type: 'lockfile' },
        packages: [
          {
            package: {
              name: 'fixture-package',
              version: '1.0.0',
              ecosystem: 'npm',
            },
            vulnerabilities: scores.map((_, index): Vulnerability => ({
              id: `OSV-fixture-${index}`,
            })),
            groups: scores.map((score, index) => ({
              ids: [`OSV-fixture-${index}`],
              aliases: [`OSV-fixture-${index}`],
              max_severity: score,
            })),
          },
        ],
      },
    ],
    experimental_config: { licenses: { summary: false, allowlist: null } },
  };
}

const LOW_CVSS_V3 = 'CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N';

// One group whose advisory carries a database_specific.severity label and,
// optionally, the severity vectors the scanner scored as `score`.
function labelled(
  score: string,
  label: string | number,
  vectors = [LOW_CVSS_V3]
) {
  const output = report([score]);
  output.results[0].packages[0].vulnerabilities[0] = {
    id: 'OSV-fixture-0',
    severity: vectors.map((vector) => ({ type: 'CVSS_V3', score: vector })),
    database_specific: { severity: label },
  };
  return output;
}

function runAudit(
  output: string,
  status: number,
  { stderr = '', signal = false, missingScanner = false, now = Date.now() } = {}
) {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-osv-audit-'));
  workspaces.push(workspace);
  const scanner = join(workspace, 'osv-scanner');
  writeFileSync(
    scanner,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (process.env.OSV_FIXTURE_SIGNAL === '1') process.kill(process.pid, 'SIGTERM');
if (!args.includes('--verbosity=error')) process.stderr.write('Scanning lockfile\\n');
process.stderr.write(process.env.OSV_FIXTURE_STDERR);
let output = process.env.OSV_FIXTURE_OUTPUT;
if (!args.includes('--format=json')) output = 'OSV table output';
if (!args.includes('--all-packages') && process.env.OSV_FIXTURE_STATUS === '0') {
  output = JSON.stringify({ results: [] });
}
process.stdout.write(output);
process.exitCode = Number(process.env.OSV_FIXTURE_STATUS);
`
  );
  chmodSync(scanner, 0o755);
  if (missingScanner) rmSync(scanner);

  const env = { ...process.env };
  for (const key of [
    'NODE_CHANNEL_FD',
    'NODE_CHANNEL_SERIALIZATION_MODE',
    'NODE_UNIQUE_ID',
    'NODE_OPTIONS',
  ]) {
    delete env[key];
  }
  // Load the audit only after setting the child clock; static imports run first.
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `Date.now = () => ${now}; await import(${JSON.stringify(auditScript)});`,
    ],
    {
      cwd: workspace,
      env: {
        ...env,
        // Restrict the missing-scanner case so a host installation cannot mask it.
        PATH: missingScanner
          ? workspace
          : `${workspace}:${process.env.PATH ?? ''}`,
        OSV_FIXTURE_OUTPUT: output,
        OSV_FIXTURE_STATUS: String(status),
        OSV_FIXTURE_STDERR: stderr,
        OSV_FIXTURE_SIGNAL: signal ? '1' : '0',
      },
      encoding: 'utf8',
    }
  );
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('OSV audit process boundary', () => {
  it('accepts a completed scan with packages and no advisories', () => {
    const clean = report();
    // These arrays are omitted by Go's omitempty tags on clean packages.
    const { package: pkg } = clean.results[0].packages[0];
    const output = {
      ...clean,
      results: [{ ...clean.results[0], packages: [{ package: pkg }] }],
    };
    expect(runAudit(JSON.stringify(output), 0).status).toBe(0);
  });

  it('ignores classifiable findings immediately below the HIGH boundary', () => {
    expect(runAudit(JSON.stringify(report(['6.9'])), 1).status).toBe(0);
  });

  it('blocks HIGH and CRITICAL groups even after a lower-severity finding', () => {
    const result = runAudit(JSON.stringify(report(['3.9', '7.0', '9.0'])), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'HIGH 7.0 fixture-package@1.0.0: OSV-fixture-1'
    );
    expect(result.stderr).toContain(
      'CRITICAL 9.0 fixture-package@1.0.0: OSV-fixture-2'
    );
  });

  it('blocks braces GHSA-vfj7-8cjw-p6xm with no exception at any date', () => {
    const output = report(['8.7']);
    const pkg = output.results[0].packages[0];
    pkg.package.name = 'braces';
    pkg.package.version = '3.0.3';
    pkg.vulnerabilities[0].id = 'GHSA-vfj7-8cjw-p6xm';
    pkg.groups[0].ids = ['GHSA-vfj7-8cjw-p6xm'];
    pkg.groups[0].aliases = ['CVE-2026-93687'];
    const formerExpiry = Date.parse('2026-11-04T00:00:00Z');
    for (const now of [formerExpiry - 1, formerExpiry]) {
      const result = runAudit(JSON.stringify(output), 1, { now });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('exception');
      expect(result.stderr).toContain(
        'HIGH 8.7 braces@3.0.3: GHSA-vfj7-8cjw-p6xm'
      );
    }
  });

  it('cannot pass a network failure with a clean-looking JSON body', () => {
    const result = runAudit(JSON.stringify(report()), 127, {
      stderr: 'OSV API unavailable\n',
    });
    expect(result.status).toBe(2);
  });

  it('rejects partial API results when the pinned scanner returns findings exit 1', () => {
    const result = runAudit(JSON.stringify(report(['5.4'])), 1, {
      stderr: 'error when retrieving vulns: context deadline exceeded\n',
    });
    expect(result.status).toBe(2);
  });

  it('fails if the scanner cannot be launched', () => {
    expect(
      runAudit(JSON.stringify(report()), 0, { missingScanner: true }).status
    ).toBe(2);
  });

  it('fails if the scanner is terminated before returning a complete result', () => {
    expect(runAudit(JSON.stringify(report()), 0, { signal: true }).status).toBe(
      2
    );
  });

  it('rejects truncated JSON rather than treating it as no advisories', () => {
    expect(runAudit('{"results":', 0).status).toBe(2);
  });

  it('rejects an empty scan rather than treating it as a clean lockfile', () => {
    expect(
      runAudit(JSON.stringify({ ...report(), results: [] }), 0).status
    ).toBe(2);
  });

  it('blocks advisories without a CVSS score as UNKNOWN severity', () => {
    const output = report(['2.0', '']);
    const pkg = output.results[0].packages[0];
    pkg.package.name = 'dompurify';
    pkg.package.version = '3.4.16';
    pkg.vulnerabilities[1].id = 'GHSA-c6gr-qvv4-5v3f';
    pkg.groups[1].ids = ['GHSA-c6gr-qvv4-5v3f'];
    const result = runAudit(JSON.stringify(output), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Blocking advisory: UNKNOWN (no CVSS score) dompurify@3.4.16: GHSA-c6gr-qvv4-5v3f'
    );
    expect(result.stdout).toContain('1 blocking HIGH/CRITICAL/UNKNOWN groups');
    expect(result.stdout).not.toContain('No blocking');
  });

  it('has no exception path for an UNKNOWN-severity braces advisory', () => {
    const output = report(['']);
    const pkg = output.results[0].packages[0];
    pkg.package.name = 'braces';
    pkg.package.version = '3.0.3';
    pkg.vulnerabilities[0].id = 'GHSA-vfj7-8cjw-p6xm';
    pkg.groups[0].ids = ['GHSA-vfj7-8cjw-p6xm'];
    const result = runAudit(JSON.stringify(output), 1, {
      now: Date.parse('2026-01-01T00:00:00Z'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'UNKNOWN (no CVSS score) braces@3.0.3: GHSA-vfj7-8cjw-p6xm'
    );
  });

  it('blocks a CRITICAL label even when its CVSS vector scores 1.8', () => {
    const result = runAudit(JSON.stringify(labelled('1.8', 'CRITICAL')), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Blocking advisory: CRITICAL (severity label; CVSS 1.8) fixture-package@1.0.0: OSV-fixture-0'
    );
    expect(result.stdout).toContain('1 blocking HIGH/CRITICAL/UNKNOWN groups');
  });

  it('blocks on the worst label among aliased advisories in one group', () => {
    const output = labelled('1.8', 'LOW');
    const pkg = output.results[0].packages[0];
    pkg.vulnerabilities.push({
      ...pkg.vulnerabilities[0],
      id: 'OSV-fixture-alias',
      database_specific: { severity: 'HIGH' },
    });
    pkg.groups[0].ids.push('OSV-fixture-alias');
    const result = runAudit(JSON.stringify(output), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'HIGH (severity label; CVSS 1.8) fixture-package@1.0.0: OSV-fixture-0, OSV-fixture-alias'
    );
  });

  it('blocks a HIGH CVSS score even when the label is LOW', () => {
    const result = runAudit(JSON.stringify(labelled('8.1', 'LOW')), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Blocking advisory: HIGH 8.1 fixture-package@1.0.0: OSV-fixture-0'
    );
  });

  it('blocks a CRITICAL label with no severity vectors', () => {
    const result = runAudit(JSON.stringify(labelled('', 'CRITICAL', [])), 1);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Blocking advisory: CRITICAL (severity label; no CVSS score) fixture-package@1.0.0: OSV-fixture-0'
    );
  });

  it('passes a MODERATE label beside a CVSS score below 7.0', () => {
    const result = runAudit(JSON.stringify(labelled('1.8', 'MODERATE')), 1);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0 blocking HIGH/CRITICAL/UNKNOWN groups');
  });

  it('keeps an unscorable vector UNKNOWN even beside a low label', () => {
    const result = runAudit(
      JSON.stringify(labelled('', 'LOW', ['CVSS:3.1/AV:N/AC:L/garbage'])),
      1
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Blocking advisory: UNKNOWN (no CVSS score) fixture-package@1.0.0: OSV-fixture-0'
    );
  });

  it('rejects an unrecognized severity label as an incompatible schema', () => {
    for (const label of ['critical', 'SEVERE', '', 9]) {
      expect(runAudit(JSON.stringify(labelled('1.8', label)), 1).status).toBe(
        2
      );
    }
  });

  it('rejects a missing or whitespace CVSS field as an incompatible schema', () => {
    const missing = JSON.stringify(report(['5.0']), (key, value) =>
      key === 'max_severity' ? undefined : value
    );
    expect(missing).not.toContain('max_severity');
    expect(runAudit(missing, 1).status).toBe(2);
    expect(runAudit(JSON.stringify(report([' '])), 1).status).toBe(2);
  });

  it('rejects label-only severity data from an incompatible scanner schema', () => {
    expect(runAudit(JSON.stringify(report(['LOW'])), 1).status).toBe(2);
  });

  it('requires every reported advisory to belong to a classified group', () => {
    const output = report(['4.0']);
    output.results[0].packages[0].vulnerabilities.push({ id: 'OSV-ungrouped' });
    expect(runAudit(JSON.stringify(output), 1).status).toBe(2);
  });

  it('rejects group IDs that do not refer to a reported advisory', () => {
    const output = report(['4.0']);
    output.results[0].packages[0].groups[0].ids = ['OSV-unreported'];
    expect(runAudit(JSON.stringify(output), 1).status).toBe(2);
  });

  it('rejects a findings exit without findings instead of hiding an unknown error', () => {
    expect(runAudit(JSON.stringify(report()), 1).status).toBe(2);
  });

  it('rejects a clean exit that contradicts the reported findings', () => {
    expect(runAudit(JSON.stringify(report(['4.0'])), 0).status).toBe(2);
  });
});
