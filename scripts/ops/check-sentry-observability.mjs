#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const DEFAULT_MANIFEST = path.join(ROOT, 'config/sentry-observability.json');
const SENTRY_COMMAND_TIMEOUT_MS = 30_000;

function asArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

function splitSet(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

function sameSet(left, right) {
  return JSON.stringify(splitSet(left)) === JSON.stringify(splitSet(right));
}
function conditionType(condition) {
  if (Object.prototype.toString.call(condition?.type) === '[object String]') {
    return condition.type;
  }
  if (Object.prototype.toString.call(condition?.id) !== '[object String]') {
    return null;
  }
  const parts = condition.id.split('.');
  return parts.length >= 2 ? parts.at(-2) : null;
}

function normalizeRule(rule) {
  const actionFilters = Array.isArray(rule.actionFilters)
    ? rule.actionFilters
    : [];
  const rawActions = Array.isArray(rule.actions)
    ? rule.actions
    : actionFilters.flatMap((entry) => entry.actions ?? []);
  const rawFilters = Array.isArray(rule.filters)
    ? rule.filters
    : actionFilters.flatMap((entry) => entry.conditions ?? []);
  const rawConditions = Array.isArray(rule.conditions)
    ? rule.conditions
    : Array.isArray(rule.triggers?.conditions)
      ? rule.triggers.conditions
      : [];
  const conditionTypes = rawConditions
    .map(conditionType)
    .filter((type) => type !== null);
  const filterLogicValues = [
    ...(Object.prototype.toString.call(rule.filterMatch) === '[object String]'
      ? [rule.filterMatch]
      : []),
    ...actionFilters
      .map((entry) => entry.logicType)
      .filter(
        (logicType) =>
          Object.prototype.toString.call(logicType) === '[object String]'
      ),
  ];
  const tagFilters = rawFilters.filter((filter) => {
    const comparison = filter.comparison ?? filter.config;
    return (
      filter.type === 'tagged_event' ||
      (filter.type === undefined &&
        (comparison?.key !== undefined || comparison?.value !== undefined))
    );
  });
  const tagFilterEntries = tagFilters.flatMap((filter) => {
    const comparison = filter.comparison ?? filter.config;
    const key = comparison?.key;
    const value = comparison?.value;
    if (
      Object.prototype.toString.call(key) !== '[object String]' ||
      Object.prototype.toString.call(value) !== '[object String]'
    ) {
      return [];
    }
    return [{ key: String(key), value: String(value) }];
  });
  return {
    name: rule.name,
    enabled: rule.enabled !== false,
    actions: rawActions.map((action) => ({
      type: action.type ?? action.id?.split('/').at(-1),
      status: action.status ?? action.config?.status,
      target:
        action.target ??
        action.config?.targetIdentifier ??
        action.config?.targetDisplay,
    })),
    malformedTagFilterCount: tagFilters.length - tagFilterEntries.length,
    tagFilterEntries,
    tagFilters: Object.fromEntries(
      tagFilterEntries.map(({ key, value }) => [key, value])
    ),
    triggerLogic: rule.actionMatch ?? rule.triggers?.logicType,
    conditionTypes,
    malformedConditionCount: rawConditions.length - conditionTypes.length,
    filterLogic:
      new Set(filterLogicValues).size === 1 ? filterLogicValues[0] : null,
    malformedFilterLogic: new Set(filterLogicValues).size > 1,
    frequencyMinutes: rule.frequency ?? rule.config?.frequency,
  };
}

function normalizeMonitor(monitor) {
  const config = monitor.config ?? {};
  return {
    slug: monitor.slug,
    status: monitor.status,
    isMuted: monitor.isMuted,
    schedule: config.schedule,
    timezone: config.timezone,
    maxRuntimeMinutes: config.max_runtime,
    checkinMarginMinutes: config.checkin_margin,
    recoveryThreshold: config.recovery_threshold,
    failureIssueThreshold: config.failure_issue_threshold,
  };
}

function actionMatches(actualActions, expected) {
  return actualActions.some(
    (action) =>
      action.type === expected.type &&
      action.status === expected.status &&
      (expected.target === undefined || action.target === expected.target)
  );
}

export function auditSentryObservability(manifest, snapshot) {
  const failures = [];
  const rules = asArray(snapshot.issueAlerts, 'snapshot.issueAlerts').map(
    normalizeRule
  );
  const monitors = asArray(snapshot.cronMonitors, 'snapshot.cronMonitors').map(
    normalizeMonitor
  );
  const releases = asArray(snapshot.releases, 'snapshot.releases');
  const uptimeMonitors = asArray(
    snapshot.uptimeMonitors,
    'snapshot.uptimeMonitors'
  );
  const dashboard = snapshot.dashboard;

  for (const expected of asArray(
    manifest.issueAlerts?.required,
    'manifest.issueAlerts.required'
  )) {
    const matches = rules.filter((rule) => rule.name === expected.name);
    if (matches.length !== 1) {
      failures.push(
        `alert:${expected.name}:expected-one:found-${matches.length}`
      );
      continue;
    }
    const [actual] = matches;
    if (actual.enabled !== expected.enabled) {
      failures.push(`alert:${expected.name}:enabled-drift`);
    }
    if (!actionMatches(actual.actions, expected.action)) {
      failures.push(`alert:${expected.name}:action-drift`);
    }
    if (expected.trigger) {
      if (actual.triggerLogic !== expected.trigger.logic) {
        failures.push(`alert:${expected.name}:trigger-logic-drift`);
      }
      if (
        JSON.stringify([...actual.conditionTypes].sort()) !==
        JSON.stringify([...expected.trigger.conditionTypes].sort())
      ) {
        failures.push(`alert:${expected.name}:trigger-conditions-drift`);
      }
      if (actual.malformedConditionCount > 0) {
        failures.push(`alert:${expected.name}:trigger-condition-malformed`);
      }
    }
    if (
      expected.filterLogic !== undefined &&
      (actual.malformedFilterLogic ||
        actual.filterLogic !== expected.filterLogic)
    ) {
      failures.push(`alert:${expected.name}:filter-logic-drift`);
    }
    if (
      expected.frequencyMinutes !== undefined &&
      actual.frequencyMinutes !== expected.frequencyMinutes
    ) {
      failures.push(`alert:${expected.name}:frequency-drift`);
    }
    const expectedFilters = expected.tagFilters ?? {};
    for (const [key, value] of Object.entries(expectedFilters)) {
      const entries = actual.tagFilterEntries.filter(
        (entry) => entry.key === key
      );
      if (entries.length !== 1) {
        failures.push(
          `alert:${expected.name}:tag-filter-${key}-expected-one:found-${entries.length}`
        );
      } else if (!sameSet(entries[0].value, value)) {
        failures.push(`alert:${expected.name}:tag-filter-${key}-drift`);
      }
    }
    for (const key of new Set(
      actual.tagFilterEntries.map((entry) => entry.key)
    )) {
      if (!Object.hasOwn(expectedFilters, key)) {
        failures.push(`alert:${expected.name}:tag-filter-${key}-undeclared`);
      }
    }
    if (actual.malformedTagFilterCount > 0) {
      failures.push(`alert:${expected.name}:tag-filter-malformed`);
    }
  }

  const expectedMonitors = asArray(
    manifest.cronMonitors?.required,
    'manifest.cronMonitors.required'
  );
  const expectedSlugs = new Set(
    expectedMonitors.map((monitor) => monitor.slug)
  );
  for (const expected of expectedMonitors) {
    const matches = monitors.filter(
      (monitor) => monitor.slug === expected.slug
    );
    if (matches.length !== 1) {
      failures.push(
        `cron-monitor:${expected.slug}:expected-one:found-${matches.length}`
      );
      continue;
    }
    const [actual] = matches;
    for (const field of [
      'status',
      'isMuted',
      'schedule',
      'timezone',
      'maxRuntimeMinutes',
      'checkinMarginMinutes',
      'recoveryThreshold',
      'failureIssueThreshold',
    ]) {
      if (actual[field] !== expected[field]) {
        failures.push(`cron-monitor:${expected.slug}:${field}-drift`);
      }
    }
  }
  for (const slug of manifest.cronMonitors?.forbidden ?? []) {
    if (monitors.some((monitor) => monitor.slug === slug)) {
      failures.push(`cron-monitor:${slug}:forbidden`);
    }
  }
  for (const monitor of monitors) {
    if (
      monitor.slug?.startsWith('linejam-') &&
      !expectedSlugs.has(monitor.slug) &&
      !(manifest.cronMonitors?.forbidden ?? []).includes(monitor.slug)
    ) {
      failures.push(`cron-monitor:${monitor.slug}:undeclared`);
    }
  }
  const expectedUptime = asArray(
    manifest.uptimeMonitors?.required,
    'manifest.uptimeMonitors.required'
  );
  for (const expected of expectedUptime) {
    const matches = uptimeMonitors.filter(
      (monitor) =>
        monitor.name === expected.name &&
        monitor.projectSlug === expected.projectSlug
    );
    if (matches.length !== 1) {
      failures.push(
        `uptime-monitor:${expected.name}:expected-one:found-${matches.length}`
      );
      continue;
    }
    const [actual] = matches;
    for (const field of [
      'status',
      'environment',
      'url',
      'method',
      'intervalSeconds',
      'timeoutMs',
      'recoveryThreshold',
      'downtimeThreshold',
      'traceSampling',
      'responseCaptureEnabled',
    ]) {
      if (actual[field] !== expected[field]) {
        failures.push(`uptime-monitor:${expected.name}:${field}-drift`);
      }
    }
  }
  const expectedUptimeIds = new Set(
    expectedUptime.map((monitor) => String(monitor.id))
  );
  for (const monitor of uptimeMonitors) {
    if (
      monitor.projectSlug === manifest.project &&
      !expectedUptimeIds.has(String(monitor.id))
    ) {
      failures.push(`uptime-monitor:${monitor.name}:undeclared`);
    }
  }

  if (manifest.release?.requiresDeployMarker) {
    const deployed = releases.find(
      (release) => Number(release.deployCount) > 0 && release.lastDeploy
    );
    if (releases.length === 0) {
      failures.push('release:production:missing');
    } else if (!deployed) {
      failures.push('release:production:deploy-marker-missing');
    } else if (
      deployed.lastDeploy.environment !== manifest.release.environment
    ) {
      failures.push('release:production:deploy-environment-drift');
    }
  }

  if (!dashboard || String(dashboard.id) !== String(manifest.dashboard?.id)) {
    failures.push('dashboard:identity-drift');
  } else {
    if (dashboard.title !== manifest.dashboard.title) {
      failures.push('dashboard:title-drift');
    }
    const titles = new Set(
      asArray(dashboard.widgets, 'snapshot.dashboard.widgets').map(
        (widget) => widget.title
      )
    );
    for (const title of manifest.dashboard.requiredWidgets ?? []) {
      if (!titles.has(title))
        failures.push(`dashboard:widget-missing:${title}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    counts: {
      issueAlerts: rules.length,
      cronMonitors: monitors.length,
      uptimeMonitors: uptimeMonitors.length,
      releases: releases.length,
      dashboardWidgets: Array.isArray(dashboard?.widgets)
        ? dashboard.widgets.length
        : 0,
    },
  };
}

function runSentry(args, sentryBin = process.env.SENTRY_BIN || 'sentry') {
  const result = spawnSync(sentryBin, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    timeout: SENTRY_COMMAND_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr.trim() || `exit ${result.status}`;
    throw new Error(`Sentry read failed (${args.join(' ')}): ${detail}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Sentry returned invalid JSON (${args.join(' ')})`);
  }
}

export function collectSentryObservability(manifest) {
  const target = `${manifest.organization}/${manifest.project}`;
  const issueAlertResponse = runSentry([
    'alert',
    'issues',
    'list',
    target,
    '--json',
  ]);
  return {
    issueAlerts: issueAlertResponse.data ?? issueAlertResponse,
    cronMonitors: runSentry(['monitor', 'list', target, '--fresh', '--json']),
    uptimeMonitors: runSentry([
      'api',
      `organizations/${manifest.organization}/uptime/`,
    ]),
    releases: runSentry([
      'api',
      `/api/0/organizations/${manifest.organization}/releases/?project=${manifest.projectId}&per_page=25`,
    ]),
    dashboard: runSentry([
      'dashboard',
      'view',
      manifest.organization,
      String(manifest.dashboard.id),
      '--json',
    ]),
  };
}
export function auditLiveSentryObservability(
  manifest,
  collect = collectSentryObservability
) {
  const first = auditSentryObservability(manifest, collect(manifest));
  if (first.ok) return first;
  return auditSentryObservability(manifest, collect(manifest));
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function parseArgs(argv) {
  const options = { manifest: DEFAULT_MANIFEST, fixture: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') options.json = true;
    else if (value === '--manifest') options.manifest = argv[++index];
    else if (value === '--fixture') options.fixture = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const manifest = await readJson(path.resolve(options.manifest));
  if (manifest.schemaVersion !== 1) {
    throw new Error('Unsupported Sentry observability manifest schema');
  }
  const result = options.fixture
    ? auditSentryObservability(
        manifest,
        await readJson(path.resolve(options.fixture))
      )
    : auditLiveSentryObservability(manifest);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write('Sentry observability contract: ok\n');
  } else {
    process.stderr.write('Sentry observability contract: drift\n');
    for (const failure of result.failures)
      process.stderr.write(`- ${failure}\n`);
  }
  return result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `Sentry observability audit failed closed: ${error.message}\n`
      );
      process.exitCode = 2;
    });
}
