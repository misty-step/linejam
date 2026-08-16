import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../config/sentry-observability.json';
import {
  auditSentryObservability,
  collectSentryObservability,
  main,
} from '../../scripts/ops/check-sentry-observability.mjs';
interface AlertActionFixture {
  config?: {
    status?: string;
    targetDisplay?: string;
  };
  id?: string;
  status?: string;
  target?: string;
  type?: string;
}

interface AlertFilterFixture {
  comparison?: { key: string; value: string };
  config?: { key: string; value: string };
  unrelated?: boolean;
}

interface IssueAlertFixture {
  actionFilters?: Array<{
    actions?: AlertActionFixture[] | null;
    conditions?: AlertFilterFixture[];
  }>;
  actions?: AlertActionFixture[] | null;
  enabled: boolean;
  filters?: AlertFilterFixture[] | null;
  name: string;
}

interface CronMonitorFixture {
  config?: {
    checkin_margin: number;
    max_runtime: number;
    schedule: string;
    timezone: string;
  };
  isMuted: boolean;
  slug: string;
  status: string;
}

interface ObservabilitySnapshotFixture {
  cronMonitors: CronMonitorFixture[];
  dashboard: {
    id: string;
    title: string;
    widgets: Array<{ title: string }>;
  };
  issueAlerts: IssueAlertFixture[];
  releases: Array<{
    deployCount: number;
    lastDeploy: { environment: string } | null;
    version: string;
  }>;
}

function passingSnapshot(): ObservabilitySnapshotFixture {
  return {
    issueAlerts: manifest.issueAlerts.required.map((rule) => ({
      name: rule.name,
      enabled: rule.enabled,
      actions: [rule.action],
      filters: Object.entries(rule.tagFilters ?? {}).map(([key, value]) => ({
        comparison: { key, value },
      })),
    })),
    cronMonitors: manifest.cronMonitors.required.map((monitor) => ({
      slug: monitor.slug,
      status: monitor.status,
      isMuted: monitor.isMuted,
      config: {
        schedule: monitor.schedule,
        timezone: monitor.timezone,
        max_runtime: monitor.maxRuntimeMinutes,
        checkin_margin: monitor.checkinMarginMinutes,
      },
    })),
    releases: [
      {
        version: 'a'.repeat(40),
        deployCount: 1,
        lastDeploy: { environment: manifest.release.environment },
      },
    ],
    dashboard: {
      id: manifest.dashboard.id,
      title: manifest.dashboard.title,
      widgets: manifest.dashboard.requiredWidgets.map((title) => ({ title })),
    },
  };
}

const workspaces: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SENTRY_BIN;
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('Sentry observability contract', () => {
  it('accepts the complete declared Linejam state', () => {
    expect(auditSentryObservability(manifest, passingSnapshot())).toMatchObject(
      {
        ok: true,
        failures: [],
      }
    );
  });

  it('accepts a production deploy marker behind newer undeployed CI releases', () => {
    const snapshot = passingSnapshot();
    snapshot.releases.unshift({
      version: 'b'.repeat(40),
      deployCount: 0,
      lastDeploy: null,
    });
    expect(auditSentryObservability(manifest, snapshot)).toMatchObject({
      ok: true,
      failures: [],
    });
  });

  it('fails on disabled alerts, obsolete signals, absent deploys, and empty dashboards', () => {
    const snapshot = passingSnapshot();
    snapshot.issueAlerts.find(
      (rule) => rule.name === 'New Unhandled Exception'
    )!.enabled = false;
    snapshot.cronMonitors.push({
      slug: 'linejam-production-health',
      status: 'active',
      isMuted: false,
      config: {
        schedule: '*/5 * * * *',
        timezone: 'UTC',
        max_runtime: 1,
        checkin_margin: 2,
      },
    });
    snapshot.releases[0].deployCount = 0;
    snapshot.releases[0].lastDeploy = null;
    snapshot.dashboard.widgets = [];

    const result = auditSentryObservability(manifest, snapshot);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'alert:New Unhandled Exception:enabled-drift',
        'cron-monitor:linejam-production-health:forbidden',
        'release:production:deploy-marker-missing',
        'dashboard:widget-missing:Unresolved Errors',
      ])
    );
  });

  it('fails on stale bridge operations and duplicate rule identities', () => {
    const snapshot = passingSnapshot();
    const bridge = snapshot.issueAlerts.find((rule) =>
      rule.name.startsWith('GitHub bridge: New')
    )!;
    const operationFilter = bridge.filters?.find(
      (filter) => filter.comparison?.key === 'operation'
    );
    expect(operationFilter?.comparison).toBeDefined();
    if (!operationFilter?.comparison) {
      throw new Error('operation filter missing');
    }
    operationFilter.comparison.value += ',generateGhostLine';
    snapshot.issueAlerts.push(structuredClone(bridge));

    const result = auditSentryObservability(manifest, snapshot);
    expect(result.failures).toContain(
      'alert:GitHub bridge: New operational issue:expected-one:found-2'
    );
  });

  it('rejects an undeclared Linejam cron monitor', () => {
    const snapshot = passingSnapshot();
    snapshot.cronMonitors.push({
      slug: 'linejam-unknown-job',
      status: 'active',
      isMuted: false,
      config: {
        schedule: '0 * * * *',
        timezone: 'UTC',
        max_runtime: 5,
        checkin_margin: 5,
      },
    });

    expect(auditSentryObservability(manifest, snapshot).failures).toContain(
      'cron-monitor:linejam-unknown-job:undeclared'
    );
  });
});

it('reports every declared identity and field drift', () => {
  const snapshot = passingSnapshot();
  snapshot.issueAlerts.shift();
  const alert = snapshot.issueAlerts[0];
  alert.actions = [{ type: 'slack', status: 'resolved', target: 'wrong' }];
  alert.filters = [{ config: { key: 'environment', value: 'staging' } }];
  Object.assign(snapshot.cronMonitors[0], {
    status: 'disabled',
    isMuted: true,
    config: {
      schedule: '0 0 * * *',
      timezone: 'Etc/GMT',
      max_runtime: 99,
      checkin_margin: 99,
    },
  });
  snapshot.releases[0].lastDeploy = { environment: 'staging' };
  snapshot.dashboard.title = 'Wrong dashboard';

  const result = auditSentryObservability(manifest, snapshot);
  expect(result.failures).toEqual(
    expect.arrayContaining([
      expect.stringContaining('expected-one:found-0'),
      expect.stringContaining('action-drift'),
      expect.stringContaining('tag-filter-runtime-drift'),
      expect.stringContaining('status-drift'),
      expect.stringContaining('isMuted-drift'),
      expect.stringContaining('schedule-drift'),
      expect.stringContaining('timezone-drift'),
      expect.stringContaining('maxRuntimeMinutes-drift'),
      expect.stringContaining('checkinMarginMinutes-drift'),
      'release:production:deploy-environment-drift',
      'dashboard:title-drift',
    ])
  );
});

it('normalizes legacy action-filter payloads and rejects malformed arrays', () => {
  const snapshot = passingSnapshot();
  const alert = snapshot.issueAlerts[0];
  const action = alert.actions![0];
  const conditions = alert.filters ?? [];
  delete alert.actions;
  delete alert.filters;
  alert.actionFilters = [
    {
      actions: [
        {
          id: `sentry.rules.actions/${action.type}`,
          config: {
            status: action.status,
            targetDisplay: action.target,
          },
        },
      ],
      conditions,
    },
  ];
  expect(auditSentryObservability(manifest, snapshot).ok).toBe(true);
  expect(() =>
    auditSentryObservability(manifest, {
      ...snapshot,
      issueAlerts: null,
    })
  ).toThrow('snapshot.issueAlerts must be an array');
  expect(() =>
    auditSentryObservability(
      { ...manifest, issueAlerts: { required: null } },
      snapshot
    )
  ).toThrow('manifest.issueAlerts.required must be an array');
});

it('reports missing release and dashboard identities', () => {
  const snapshot = passingSnapshot();
  snapshot.releases = [];
  const result = auditSentryObservability(manifest, {
    ...snapshot,
    dashboard: null,
  });
  expect(result.failures).toEqual(
    expect.arrayContaining([
      'release:production:missing',
      'dashboard:identity-drift',
    ])
  );
  expect(result.counts.dashboardWidgets).toBe(0);
});

it('runs fixture mode in JSON, success, and drift output modes', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-sentry-audit-'));
  workspaces.push(workspace);
  const manifestPath = join(workspace, 'manifest.json');
  const snapshotPath = join(workspace, 'snapshot.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(snapshotPath, JSON.stringify(passingSnapshot()));
  const stdout = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  const stderr = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);

  await expect(
    main(['--manifest', manifestPath, '--fixture', snapshotPath, '--json'])
  ).resolves.toBe(0);
  expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"ok": true'));

  stdout.mockClear();
  await expect(
    main(['--manifest', manifestPath, '--fixture', snapshotPath])
  ).resolves.toBe(0);
  expect(stdout).toHaveBeenCalledWith('Sentry observability contract: ok\n');

  const drift = passingSnapshot();
  writeFileSync(snapshotPath, JSON.stringify({ ...drift, dashboard: null }));
  await expect(
    main(['--manifest', manifestPath, '--fixture', snapshotPath])
  ).resolves.toBe(1);
  expect(stderr).toHaveBeenCalledWith('Sentry observability contract: drift\n');
  expect(stderr).toHaveBeenCalledWith('- dashboard:identity-drift\n');
});

it('fails closed on invalid CLI and manifest inputs', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-sentry-audit-'));
  workspaces.push(workspace);
  const manifestPath = join(workspace, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify({ ...manifest, schemaVersion: 2 })
  );
  await expect(main(['--unknown'])).rejects.toThrow('Unknown argument');
  await expect(main(['--manifest', manifestPath])).rejects.toThrow(
    'Unsupported Sentry observability manifest schema'
  );
});

it('collects CLI responses and fails without exposing invalid payloads', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'linejam-sentry-cli-'));
  workspaces.push(workspace);
  const sentryBin = join(workspace, 'sentry');
  writeFileSync(
    sentryBin,
    `#!/bin/sh
case "$1" in
  alert) printf '%s' '{"data":[]}' ;;
  monitor) printf '%s' '[]' ;;
  api) printf '%s' '[]' ;;
  dashboard) printf '%s' '{"id":"1","title":"x","widgets":[]}' ;;
esac
`
  );
  chmodSync(sentryBin, 0o700);
  process.env.SENTRY_BIN = sentryBin;
  expect(collectSentryObservability(manifest)).toMatchObject({
    issueAlerts: [],
    cronMonitors: [],
    releases: [],
    dashboard: { id: '1' },
  });

  writeFileSync(sentryBin, '#!/bin/sh\nprintf not-json\n');
  expect(() => collectSentryObservability(manifest)).toThrow(
    'Sentry returned invalid JSON'
  );
  writeFileSync(sentryBin, '#!/bin/sh\necho provider-secret >&2\nexit 7\n');
  expect(() => collectSentryObservability(manifest)).toThrow(
    'Sentry read failed'
  );
});

it('reports a missing declared monitor and exercises the executable boundary', () => {
  const missingMonitor = passingSnapshot();
  missingMonitor.cronMonitors = [];
  expect(auditSentryObservability(manifest, missingMonitor).failures).toContain(
    'cron-monitor:linejam-production-smoke:expected-one:found-0'
  );

  const workspace = mkdtempSync(join(tmpdir(), 'linejam-sentry-audit-cli-'));
  workspaces.push(workspace);
  const manifestPath = join(workspace, 'manifest.json');
  const snapshotPath = join(workspace, 'snapshot.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(snapshotPath, JSON.stringify(passingSnapshot()));
  const success = spawnSync(
    process.execPath,
    [
      'scripts/ops/check-sentry-observability.mjs',
      '--manifest',
      manifestPath,
      '--fixture',
      snapshotPath,
    ],
    { cwd: process.cwd(), encoding: 'utf8', env: process.env }
  );
  expect(success.status, success.stderr).toBe(0);
  expect(success.stdout).toBe('Sentry observability contract: ok\n');

  const failure = spawnSync(
    process.execPath,
    ['scripts/ops/check-sentry-observability.mjs', '--unknown'],
    { cwd: process.cwd(), encoding: 'utf8', env: process.env }
  );
  expect(failure.status).toBe(2);
  expect(failure.stderr).toContain(
    'Sentry observability audit failed closed: Unknown argument'
  );
});

it('normalizes absent optional provider fields and manifest sections', async () => {
  const snapshot = passingSnapshot();
  const alert = snapshot.issueAlerts[0];
  delete alert.actions;
  delete alert.filters;
  alert.actionFilters = [
    { actions: null, conditions: [{ unrelated: true }] },
    {},
  ];
  snapshot.cronMonitors[0].config = undefined;
  const optionalManifest = {
    ...structuredClone(manifest),
    cronMonitors: {
      ...manifest.cronMonitors,
      forbidden: undefined,
    },
    release: {
      ...manifest.release,
      requiresDeployMarker: false,
    },
    dashboard: {
      ...manifest.dashboard,
      requiredWidgets: undefined,
    },
  };
  const result = auditSentryObservability(optionalManifest, snapshot);
  expect(result.failures).toEqual(
    expect.arrayContaining([
      expect.stringContaining('action-drift'),
      expect.stringContaining('schedule-drift'),
    ])
  );

  const workspace = mkdtempSync(join(tmpdir(), 'linejam-sentry-cli-array-'));
  workspaces.push(workspace);
  const sentryBin = join(workspace, 'sentry');
  writeFileSync(
    sentryBin,
    `#!/bin/sh
case "$1" in
  alert|monitor|api) printf '%s' '[]' ;;
  dashboard) printf '%s' '{"id":"9551300","title":"Linejam Reliability","widgets":[]}' ;;
esac
`
  );
  chmodSync(sentryBin, 0o700);
  process.env.SENTRY_BIN = sentryBin;
  expect(collectSentryObservability(manifest).issueAlerts).toEqual([]);

  const manifestPath = join(workspace, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(optionalManifest));
  const stdout = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  await expect(main(['--manifest', manifestPath, '--json'])).resolves.toBe(1);
  expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"ok": false'));

  process.env.SENTRY_BIN = join(workspace, 'missing-sentry');
  expect(() => collectSentryObservability(manifest)).toThrow('spawnSync');
});
