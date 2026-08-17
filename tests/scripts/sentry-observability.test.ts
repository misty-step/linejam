import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../config/sentry-observability.json';
import {
  auditSentryObservability,
  auditLiveSentryObservability,
  collectSentryObservability,
  main,
} from '../../scripts/ops/check-sentry-observability.mjs';

interface ManifestAlertRule {
  name: string;
  enabled: boolean;
  action: { type: string; status: string; target?: string };
  trigger?: { logic: string; conditionTypes: string[] };
  filterLogic?: string;
  frequencyMinutes?: number;
  tagFilters?: Record<string, string>;
}

type ManifestFixture = Omit<typeof manifest, 'issueAlerts'> & {
  issueAlerts: { required: ManifestAlertRule[] };
};
// SAFETY: the JSON import satisfies every ManifestFixture field checked by the
// audit contract; the cast widens only issueAlerts rules to optional trigger
// fields the snapshot builder already tolerates.
const baseManifest = manifest as ManifestFixture;
const filteredManifest: ManifestFixture = {
  ...baseManifest,
  issueAlerts: {
    required: [
      {
        name: 'Filtered operational alert',
        enabled: true,
        trigger: { logic: 'all', conditionTypes: ['first_seen_event'] },
        filterLogic: 'all',
        frequencyMinutes: 120,
        action: {
          type: 'webhook',
          status: 'active',
          target: 'filtered-target',
        },
        tagFilters: {
          runtime: 'convex,github-actions',
          operation: 'previewSmoke,productionSmoke',
        },
      },
    ],
  },
};
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
  comparison?: { attribute?: string; key?: string; value?: string };
  config?: { key: string; value: string };
  type?: string;
  unrelated?: boolean;
}

interface IssueAlertFixture {
  actionMatch?: string;
  actionFilters?: Array<{
    actions?: AlertActionFixture[] | null;
    conditions?: AlertFilterFixture[];
  }>;
  actions?: AlertActionFixture[] | null;
  conditions?: Array<{ id?: string; type?: string }>;
  enabled: boolean;
  filters?: AlertFilterFixture[] | null;
  filterMatch?: string;
  frequency?: number;
  name: string;
}

interface CronMonitorFixture {
  config?: {
    checkin_margin: number;
    failure_issue_threshold: number;
    max_runtime: number;
    recovery_threshold: number;
    schedule: string;
    timezone: string;
  };
  isMuted: boolean;
  slug: string;
  status: string;
  environments?: { name: string }[];
}

interface UptimeMonitorFixture {
  downtimeThreshold: number;
  id: string;
  environment: string | null;
  intervalSeconds: number;
  method: string;
  name: string;
  projectSlug: string;
  recoveryThreshold: number;
  responseCaptureEnabled: boolean;
  status: string;
  timeoutMs: number;
  traceSampling: boolean;
  url: string;
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
  uptimeMonitors: UptimeMonitorFixture[];
}

function passingSnapshot(
  source: ManifestFixture = baseManifest
): ObservabilitySnapshotFixture {
  return {
    issueAlerts: source.issueAlerts.required.map((rule) => ({
      name: rule.name,
      enabled: rule.enabled,
      actions: [rule.action],
      conditions:
        'trigger' in rule && rule.trigger
          ? rule.trigger.conditionTypes.map((type) => ({ type }))
          : undefined,
      actionMatch:
        'trigger' in rule && rule.trigger ? rule.trigger.logic : undefined,
      filterMatch: 'filterLogic' in rule ? rule.filterLogic : undefined,
      frequency: 'frequencyMinutes' in rule ? rule.frequencyMinutes : undefined,
      filters: Object.entries(rule.tagFilters ?? {}).map(([key, value]) => ({
        comparison: { key, value },
      })),
    })),
    cronMonitors: source.cronMonitors.required.map((monitor) => ({
      slug: monitor.slug,
      status: monitor.status,
      isMuted: monitor.isMuted,
      config: {
        schedule: monitor.schedule,
        timezone: monitor.timezone,
        max_runtime: monitor.maxRuntimeMinutes,
        checkin_margin: monitor.checkinMarginMinutes,
        recovery_threshold: monitor.recoveryThreshold,
        failure_issue_threshold: monitor.failureIssueThreshold,
      },
      environments: (monitor.environments ?? []).map((name) => ({ name })),
    })),
    uptimeMonitors: source.uptimeMonitors.required.map((monitor) => ({
      ...monitor,
    })),
    releases: [
      {
        version: 'a'.repeat(40),
        deployCount: 1,
        lastDeploy: { environment: source.release.environment },
      },
    ],
    dashboard: {
      id: source.dashboard.id,
      title: source.dashboard.title,
      widgets: source.dashboard.requiredWidgets.map((title) => ({ title })),
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
        recovery_threshold: 1,
        failure_issue_threshold: 2,
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

  it('fails on stale tag filters and duplicate rule identities', () => {
    const snapshot = passingSnapshot(filteredManifest);
    const filtered = snapshot.issueAlerts[0];
    const operationFilter = filtered.filters?.find(
      (filter) => filter.comparison?.key === 'operation'
    );
    expect(operationFilter?.comparison).toBeDefined();
    if (!operationFilter?.comparison) {
      throw new Error('operation filter missing');
    }
    operationFilter.comparison.value += ',generateGhostLine';
    snapshot.issueAlerts.push(structuredClone(filtered));

    const result = auditSentryObservability(filteredManifest, snapshot);
    expect(result.failures).toContain(
      'alert:Filtered operational alert:expected-one:found-2'
    );
  });

  it('fails on trigger, logic, and frequency drift', () => {
    const snapshot = passingSnapshot(filteredManifest);
    const filtered = snapshot.issueAlerts[0];
    filtered.conditions = [{ type: 'every_event' }];
    filtered.actionMatch = 'any';
    filtered.filterMatch = 'any';
    filtered.frequency = 5;

    expect(
      auditSentryObservability(filteredManifest, snapshot).failures
    ).toEqual(
      expect.arrayContaining([
        `alert:${filtered.name}:trigger-logic-drift`,
        `alert:${filtered.name}:trigger-conditions-drift`,
        `alert:${filtered.name}:filter-logic-drift`,
        `alert:${filtered.name}:frequency-drift`,
      ])
    );
  });

  it('rejects duplicate, undeclared, and malformed alert filters', () => {
    const snapshot = passingSnapshot(filteredManifest);
    const alert = snapshot.issueAlerts[0];
    const runtimeFilter = alert.filters!.find(
      (filter) => filter.comparison?.key === 'runtime'
    )!;
    alert.filters!.push(structuredClone(runtimeFilter));
    alert.filters!.push({
      comparison: { key: 'environment', value: 'preview' },
    });
    alert.filters!.push({ type: 'tagged_event', unrelated: true });
    alert.filters!.push({
      type: 'event_attribute',
      comparison: { attribute: 'error.unhandled', value: 'true' },
    });

    expect(
      auditSentryObservability(filteredManifest, snapshot).failures
    ).toEqual(
      expect.arrayContaining([
        `alert:${alert.name}:tag-filter-runtime-expected-one:found-2`,
        `alert:${alert.name}:tag-filter-environment-undeclared`,
        `alert:${alert.name}:tag-filter-malformed`,
      ])
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
        recovery_threshold: 1,
        failure_issue_threshold: 2,
      },
    });

    expect(auditSentryObservability(manifest, snapshot).failures).toContain(
      'cron-monitor:linejam-unknown-job:undeclared'
    );
  });

  it('rejects undeclared Linejam uptime monitors', () => {
    const snapshot = passingSnapshot();
    snapshot.uptimeMonitors.push({
      ...snapshot.uptimeMonitors[0],
      id: '9999999',
      name: 'Linejam duplicate health',
    });

    expect(auditSentryObservability(manifest, snapshot).failures).toContain(
      'uptime-monitor:Linejam duplicate health:undeclared'
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
      recovery_threshold: 99,
      failure_issue_threshold: 99,
    },
  });
  Object.assign(snapshot.uptimeMonitors[0], {
    status: 'disabled',
    environment: null,
    url: 'https://www.linejam.app/',
    method: 'POST',
    intervalSeconds: 300,
    timeoutMs: 1,
    recoveryThreshold: 2,
    downtimeThreshold: 4,
    traceSampling: true,
    responseCaptureEnabled: false,
  });
  snapshot.releases[0].lastDeploy = { environment: 'staging' };
  snapshot.dashboard.title = 'Wrong dashboard';

  const result = auditSentryObservability(manifest, snapshot);
  expect(result.failures).toEqual(
    expect.arrayContaining([
      expect.stringContaining('expected-one:found-0'),
      expect.stringContaining('action-drift'),
      expect.stringContaining('tag-filter-environment-undeclared'),
      expect.stringContaining('status-drift'),
      expect.stringContaining('isMuted-drift'),
      expect.stringContaining('schedule-drift'),
      expect.stringContaining('timezone-drift'),
      expect.stringContaining('maxRuntimeMinutes-drift'),
      expect.stringContaining('checkinMarginMinutes-drift'),
      expect.stringContaining('uptime-monitor:Linejam production health:'),
      expect.stringContaining('recoveryThreshold-drift'),
      expect.stringContaining('failureIssueThreshold-drift'),
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
    uptimeMonitors: [],
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

it('requires a second live sample before reporting observability drift', () => {
  const transient = passingSnapshot();
  transient.cronMonitors = [];
  const recover = vi
    .fn()
    .mockReturnValueOnce(transient)
    .mockReturnValueOnce(passingSnapshot());
  expect(auditLiveSentryObservability(manifest, recover).ok).toBe(true);
  expect(recover).toHaveBeenCalledTimes(2);

  const stable = vi.fn().mockReturnValue(passingSnapshot());
  expect(auditLiveSentryObservability(manifest, stable).ok).toBe(true);
  expect(stable).toHaveBeenCalledOnce();

  const persistent = vi.fn().mockReturnValue(transient);
  expect(auditLiveSentryObservability(manifest, persistent)).toMatchObject({
    ok: false,
    failures: expect.arrayContaining([
      'cron-monitor:linejam-production-smoke:expected-one:found-0',
    ]),
  });
  expect(persistent).toHaveBeenCalledTimes(2);
});

it('reports missing declared monitors and exercises the executable boundary', () => {
  const missingMonitor = passingSnapshot();
  missingMonitor.cronMonitors = [];
  expect(auditSentryObservability(manifest, missingMonitor).failures).toContain(
    'cron-monitor:linejam-production-smoke:expected-one:found-0'
  );
  missingMonitor.uptimeMonitors = [];
  expect(auditSentryObservability(manifest, missingMonitor).failures).toContain(
    'uptime-monitor:Linejam production health:expected-one:found-0'
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

it('reports stale cron monitor environments', () => {
  const snapshot = passingSnapshot();
  snapshot.cronMonitors[0].environments = [
    { name: 'production' },
    { name: 'preview' },
  ];
  expect(auditSentryObservability(manifest, snapshot).failures).toContain(
    'cron-monitor:linejam-production-smoke:environments-drift:expected=production:actual=preview,production'
  );

  const missing = passingSnapshot();
  delete missing.cronMonitors[0].environments;
  expect(auditSentryObservability(manifest, missing).failures).toContain(
    'cron-monitor:linejam-production-smoke:environments-drift:expected=production:actual='
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
