#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DOCTL_READ_TIMEOUT_MS = 30_000;
const DOCTL_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const COMPONENT_COLLECTIONS = [
  'services',
  'workers',
  'jobs',
  'functions',
  'static_sites',
];
const UNMODELED_LIVE_FIELDS = [
  'workers',
  'jobs',
  'functions',
  'static_sites',
  'databases',
  'envs',
];
const MODELED_APP_SPEC_FIELDS = [
  'name',
  'region',
  'features',
  'domains',
  'ingress',
  'services',
];
const MODELED_SERVICE_FIELDS = [
  'name',
  'github',
  'dockerfile_path',
  'build_command',
  'run_command',
  'http_port',
  'instance_count',
  'instance_size_slug',
  'health_check',
  'envs',
];
const MODELED_ENVIRONMENT_FIELDS = ['key', 'scope', 'type', 'value'];
const DEFAULT_MANIFEST_URL = new URL(
  '../../config/digitalocean-apps.json',
  import.meta.url
);

/** @typedef {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptionsWithStringEncoding) => { status: number | null, stdout?: string, stderr?: string, error?: NodeJS.ErrnoException }} Runner */

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value, allowed, label) {
  assertObject(value, label);
  const unsupported = Object.keys(value).filter(
    (key) => !allowed.includes(key)
  );
  if (unsupported.length > 0) {
    throw new Error(
      `${label} has unsupported fields: ${unsupported.join(',')}.`
    );
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertValuesFree(value, path = 'manifest') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertValuesFree(entry, `${path}[${index}]`)
    );
    return;
  }

  if (Object.hasOwn(value, 'value')) {
    throw new Error(`${path} must remain values-free.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    assertValuesFree(entry, `${path}.${key}`);
  }
}

function assertUnique(values, label) {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index
  );
  if (duplicates.length > 0) {
    throw new Error(
      `${label} contains duplicates: ${[...new Set(duplicates)].join(',')}.`
    );
  }
}

function validateSource(source, label) {
  assertExactKeys(source, ['repository', 'branch', 'deployOnPush'], label);
  assertString(source.repository, `${label}.repository`);
  assertString(source.branch, `${label}.branch`);
  if (
    source.deployOnPush !== undefined &&
    typeof source.deployOnPush !== 'boolean'
  ) {
    throw new Error(`${label}.deployOnPush must be boolean.`);
  }
}

function validateOwner(owner, label, withBuildCommand = false) {
  const keys = withBuildCommand
    ? ['app', 'component', 'buildCommand']
    : ['app', 'component'];
  assertExactKeys(owner, keys, label);
  assertString(owner.app, `${label}.app`);
  assertString(owner.component, `${label}.component`);
  if (withBuildCommand)
    assertString(owner.buildCommand, `${label}.buildCommand`);
}

function validateService(service, label) {
  assertExactKeys(
    service,
    [
      'name',
      'source',
      'dockerfilePath',
      'buildCommand',
      'runCommand',
      'httpPort',
      'instanceCount',
      'instanceSize',
      'healthCheckPath',
      'environment',
    ],
    label
  );
  assertString(service.name, `${label}.name`);
  validateSource(service.source, `${label}.source`);
  for (const field of ['dockerfilePath', 'buildCommand', 'runCommand']) {
    if (service[field] !== undefined)
      assertString(service[field], `${label}.${field}`);
  }
  if (!Number.isInteger(service.httpPort) || service.httpPort < 1) {
    throw new Error(`${label}.httpPort must be a positive integer.`);
  }
  if (!Number.isInteger(service.instanceCount) || service.instanceCount < 1) {
    throw new Error(`${label}.instanceCount must be a positive integer.`);
  }
  assertString(service.instanceSize, `${label}.instanceSize`);
  assertString(service.healthCheckPath, `${label}.healthCheckPath`);
  if (!Array.isArray(service.environment)) {
    throw new Error(`${label}.environment must be an array.`);
  }
  assertUnique(
    service.environment.map((entry) => entry.name),
    `${label}.environment`
  );
  service.environment.forEach((entry, index) => {
    const envLabel = `${label}.environment[${index}]`;
    assertExactKeys(entry, ['name', 'scope', 'secret'], envLabel);
    if (!ENV_NAME_PATTERN.test(entry.name)) {
      throw new Error(`${envLabel}.name must be an environment variable name.`);
    }
    assertString(entry.scope, `${envLabel}.scope`);
    if (typeof entry.secret !== 'boolean') {
      throw new Error(`${envLabel}.secret must be boolean.`);
    }
  });
}

/**
 * Validate the deliberately sanitized provider contract. It is not a provider
 * export: value fields are forbidden at every depth.
 */
export function validateDigitalOceanAppManifest(candidate) {
  assertValuesFree(candidate);
  assertExactKeys(
    candidate,
    ['schemaVersion', 'deploymentAuthority', 'apps'],
    'manifest'
  );
  if (candidate.schemaVersion !== 1) {
    throw new Error('manifest.schemaVersion must be 1.');
  }
  assertExactKeys(
    candidate.deploymentAuthority,
    ['source', 'frontendProductionOwner', 'convexProductionOwner'],
    'manifest.deploymentAuthority'
  );
  validateSource(
    candidate.deploymentAuthority.source,
    'manifest.deploymentAuthority.source'
  );
  validateOwner(
    candidate.deploymentAuthority.frontendProductionOwner,
    'manifest.deploymentAuthority.frontendProductionOwner'
  );
  validateOwner(
    candidate.deploymentAuthority.convexProductionOwner,
    'manifest.deploymentAuthority.convexProductionOwner',
    true
  );
  if (!Array.isArray(candidate.apps) || candidate.apps.length === 0) {
    throw new Error('manifest.apps must be a non-empty array.');
  }
  assertUnique(
    candidate.apps.map((app) => app.id),
    'manifest.apps ids'
  );
  assertUnique(
    candidate.apps.map((app) => app.name),
    'manifest.apps names'
  );

  candidate.apps.forEach((app, appIndex) => {
    const label = `manifest.apps[${appIndex}]`;
    assertExactKeys(
      app,
      ['id', 'name', 'region', 'features', 'domains', 'ingress', 'services'],
      label
    );
    assertString(app.id, `${label}.id`);
    assertString(app.name, `${label}.name`);
    assertString(app.region, `${label}.region`);
    if (!Array.isArray(app.features) || !Array.isArray(app.domains)) {
      throw new Error(`${label}.features and domains must be arrays.`);
    }
    app.features.forEach((feature, index) =>
      assertString(feature, `${label}.features[${index}]`)
    );
    app.domains.forEach((domain, index) => {
      const domainLabel = `${label}.domains[${index}]`;
      assertExactKeys(domain, ['domain', 'type', 'zone'], domainLabel);
      assertString(domain.domain, `${domainLabel}.domain`);
      assertString(domain.type, `${domainLabel}.type`);
      assertString(domain.zone, `${domainLabel}.zone`);
    });
    assertUnique(
      app.domains.map((domain) => domain.domain),
      `${label}.domains`
    );
    if (!Array.isArray(app.ingress) || !Array.isArray(app.services)) {
      throw new Error(`${label}.ingress and services must be arrays.`);
    }
    app.ingress.forEach((rule, index) => {
      const ruleLabel = `${label}.ingress[${index}]`;
      assertExactKeys(rule, ['pathPrefix', 'component'], ruleLabel);
      assertString(rule.pathPrefix, `${ruleLabel}.pathPrefix`);
      assertString(rule.component, `${ruleLabel}.component`);
    });
    assertUnique(
      app.ingress.map((rule) => `${rule.pathPrefix}->${rule.component}`),
      `${label}.ingress`
    );
    assertUnique(
      app.services.map((service) => service.name),
      `${label}.services`
    );
    app.services.forEach((service, index) =>
      validateService(service, `${label}.services[${index}]`)
    );
  });

  const findOwnerService = (owner, label) => {
    const app = candidate.apps.find((entry) => entry.name === owner.app);
    const service = app?.services.find(
      (entry) => entry.name === owner.component
    );
    if (!service)
      throw new Error(`${label} does not resolve to a declared service.`);
    return service;
  };
  const frontendOwner = candidate.deploymentAuthority.frontendProductionOwner;
  findOwnerService(frontendOwner, 'frontend production owner');
  const domainApps = candidate.apps.filter((app) => app.domains.length > 0);
  if (domainApps.length !== 1 || domainApps[0].name !== frontendOwner.app) {
    throw new Error(
      'Exactly the frontend production owner app must declare domains.'
    );
  }
  if (
    !domainApps[0].ingress.some(
      (rule) => rule.component === frontendOwner.component
    )
  ) {
    throw new Error(
      'Frontend production owner must own a declared ingress route.'
    );
  }
  const convexService = findOwnerService(
    candidate.deploymentAuthority.convexProductionOwner,
    'Convex production owner'
  );
  if (
    convexService.buildCommand !==
    candidate.deploymentAuthority.convexProductionOwner.buildCommand
  ) {
    throw new Error(
      'Convex production owner build command must match its service.'
    );
  }

  const authoritySource = candidate.deploymentAuthority.source;
  const allServices = candidate.apps.flatMap((app) =>
    app.services.map((service) => ({ app: app.name, service }))
  );
  for (const { app, service } of allServices) {
    if (
      service.source.repository !== authoritySource.repository ||
      service.source.branch !== authoritySource.branch ||
      service.source.deployOnPush !== true
    ) {
      throw new Error(
        `manifest service ${app}/${service.name} must use the declared source with deployOnPush enabled.`
      );
    }
  }
  const convexCommandOwners = allServices.filter(
    ({ service }) =>
      service.buildCommand ===
      candidate.deploymentAuthority.convexProductionOwner.buildCommand
  );
  if (
    convexCommandOwners.length !== 1 ||
    convexCommandOwners[0].app !==
      candidate.deploymentAuthority.convexProductionOwner.app ||
    convexCommandOwners[0].service.name !==
      candidate.deploymentAuthority.convexProductionOwner.component
  ) {
    throw new Error(
      'Exactly one declared service must own the Convex production build command.'
    );
  }

  return candidate;
}

export function loadDigitalOceanAppManifest(path = DEFAULT_MANIFEST_URL) {
  return validateDigitalOceanAppManifest(
    JSON.parse(readFileSync(path, 'utf8'))
  );
}

function optional(target, key, value) {
  if (typeof value === 'string' && value.trim() !== '') target[key] = value;
}

/** Strip provider-generated fields and every environment value. */
export function normalizeDigitalOceanApp(readback) {
  assertObject(readback, 'DigitalOcean app readback');
  assertObject(readback.spec, 'DigitalOcean app spec');
  const spec = readback.spec;
  assertExactKeys(
    spec,
    [...MODELED_APP_SPEC_FIELDS, ...UNMODELED_LIVE_FIELDS],
    `DigitalOcean app ${spec.name || 'unknown'} spec`
  );
  for (const field of UNMODELED_LIVE_FIELDS) {
    const value = spec[field];
    const populated = Array.isArray(value)
      ? value.length > 0
      : value !== undefined && value !== null;
    if (populated) {
      throw new Error(
        `DigitalOcean app ${spec.name || 'unknown'} has unsupported live field spec.${field}.`
      );
    }
  }
  assertUnique(
    (spec.services ?? []).map((service) => service.name),
    `DigitalOcean app ${spec.name || 'unknown'} services`
  );
  const services = (spec.services ?? []).map((service) => {
    assertExactKeys(
      service,
      MODELED_SERVICE_FIELDS,
      `DigitalOcean app ${spec.name || 'unknown'} service ${service.name || 'unknown'}`
    );
    assertUnique(
      (service.envs ?? []).map((entry) => entry.key),
      `DigitalOcean app ${spec.name || 'unknown'} service ${service.name || 'unknown'} environment`
    );
    (service.envs ?? []).forEach((entry) =>
      assertExactKeys(
        entry,
        MODELED_ENVIRONMENT_FIELDS,
        `DigitalOcean app ${spec.name || 'unknown'} service ${service.name || 'unknown'} environment entry`
      )
    );
    const normalized = {
      name: service.name,
      source: {
        repository: service.github?.repo,
        branch: service.github?.branch,
        deployOnPush: service.github?.deploy_on_push,
      },
      httpPort: service.http_port,
      instanceCount: service.instance_count,
      instanceSize: service.instance_size_slug,
      healthCheckPath: service.health_check?.http_path,
      environment: (service.envs ?? [])
        .map((entry) => ({
          name: entry.key,
          scope: entry.scope,
          secret: entry.type === 'SECRET',
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
    optional(normalized, 'dockerfilePath', service.dockerfile_path);
    optional(normalized, 'buildCommand', service.build_command);
    optional(normalized, 'runCommand', service.run_command);
    return normalized;
  });

  assertUnique(
    (spec.domains ?? []).map((domain) => domain.domain),
    `DigitalOcean app ${spec.name || 'unknown'} domains`
  );
  assertUnique(
    (spec.ingress?.rules ?? []).map(
      (rule) =>
        `${rule.match?.path?.prefix || 'unknown'}->${rule.component?.name || 'unknown'}`
    ),
    `DigitalOcean app ${spec.name || 'unknown'} ingress`
  );

  return {
    id: readback.id,
    name: spec.name,
    region: spec.region,
    features: [...(spec.features ?? [])].sort(),
    domains: (spec.domains ?? [])
      .map(({ domain, type, zone }) => ({ domain, type, zone }))
      .sort((left, right) => left.domain.localeCompare(right.domain)),
    ingress: (spec.ingress?.rules ?? [])
      .map((rule) => ({
        pathPrefix: rule.match?.path?.prefix,
        component: rule.component?.name,
      }))
      .sort((left, right) =>
        `${left.pathPrefix}:${left.component}`.localeCompare(
          `${right.pathPrefix}:${right.component}`
        )
      ),
    services: services.sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
  };
}

function comparisonTree(app) {
  return {
    id: app.id,
    name: app.name,
    region: app.region,
    features: [...app.features].sort(),
    domains: Object.fromEntries(
      app.domains.map(({ domain, ...details }) => [domain, details])
    ),
    ingress: Object.fromEntries(
      app.ingress.map((rule) => [`${rule.pathPrefix}->${rule.component}`, true])
    ),
    services: Object.fromEntries(
      app.services.map(({ name, environment, ...service }) => [
        name,
        {
          ...service,
          environment: Object.fromEntries(
            environment.map(({ name: envName, ...entry }) => [envName, entry])
          ),
        },
      ])
    ),
  };
}

function collectDrift(expected, actual, path, output) {
  if (Object.is(expected, actual)) return;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      output.push({ path, expected, actual });
    }
    return;
  }
  if (
    expected &&
    actual &&
    typeof expected === 'object' &&
    typeof actual === 'object'
  ) {
    const keys = [
      ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
    ].sort();
    for (const key of keys) {
      collectDrift(
        expected[key],
        actual[key],
        path ? `${path}.${key}` : key,
        output
      );
    }
    return;
  }
  output.push({ path, expected, actual });
}

export function diffDigitalOceanApp(expected, actual) {
  const drift = [];
  collectDrift(comparisonTree(expected), comparisonTree(actual), '', drift);
  return drift;
}

function parseReadback(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('DigitalOcean provider read returned invalid JSON.');
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(
      'DigitalOcean provider read returned an unexpected app shape.'
    );
  }
  return parsed[0];
}

function parseAppInventory(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('DigitalOcean app inventory returned invalid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('DigitalOcean app inventory returned an unexpected shape.');
  }
  return parsed;
}

function sourceApps(inventory, source) {
  return inventory
    .filter((app) =>
      COMPONENT_COLLECTIONS.some((collection) =>
        (app.spec?.[collection] ?? []).some(
          (component) =>
            component.github?.repo === source.repository &&
            component.github?.branch === source.branch
        )
      )
    )
    .map((app) => ({ id: app.id, name: app.spec?.name || 'unknown' }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function runProviderRead(runner, label, args) {
  const result = runner('doctl', args, {
    encoding: 'utf8',
    timeout: DOCTL_READ_TIMEOUT_MS,
    maxBuffer: DOCTL_MAX_BUFFER_BYTES,
  });
  if (result.error) {
    throw new Error(
      result.error.code === 'ETIMEDOUT'
        ? `DigitalOcean ${label} provider read timed out.`
        : `DigitalOcean ${label} provider read failed to start.`
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `DigitalOcean ${label} provider read failed with status ${result.status ?? 'unknown'}.`
    );
  }
  return result.stdout ?? '';
}

/**
 * @param {{ manifest?: any, runner?: Runner, logger?: { log: (message: string) => void } }} [options]
 */
export function runDigitalOceanDriftCheck({
  manifest = loadDigitalOceanAppManifest(),
  runner = spawnSync,
  logger = console,
} = {}) {
  const validated = validateDigitalOceanAppManifest(manifest);
  const drift = [];
  const checkedApps = [];

  const inventory = parseAppInventory(
    runProviderRead(runner, 'app inventory', [
      'apps',
      'list',
      '--output',
      'json',
    ])
  );
  const liveSourceApps = sourceApps(
    inventory,
    validated.deploymentAuthority.source
  );
  const expectedIds = validated.apps.map((app) => app.id).sort();
  const liveIds = liveSourceApps.map((app) => app.id);
  const missingIds = expectedIds.filter((id) => !liveIds.includes(id));
  const unexpectedApps = liveSourceApps.filter(
    (app) => !expectedIds.includes(app.id)
  );
  if (missingIds.length > 0 || unexpectedApps.length > 0) {
    const missingNames = validated.apps
      .filter((app) => missingIds.includes(app.id))
      .map((app) => app.name)
      .sort();
    const unexpectedNames = unexpectedApps.map((app) => app.name).sort();
    throw new Error(
      `DigitalOcean source-app drift: missing=${missingNames.join(',') || 'none'}; unexpected=${unexpectedNames.join(',') || 'none'}.`
    );
  }

  for (const app of validated.apps) {
    const actual = normalizeDigitalOceanApp(
      parseReadback(
        runProviderRead(runner, app.name, [
          'apps',
          'get',
          app.id,
          '--output',
          'json',
        ])
      )
    );
    drift.push(
      ...diffDigitalOceanApp(app, actual).map((entry) => ({
        ...entry,
        path: `apps.${app.name}.${entry.path}`,
      }))
    );
    checkedApps.push(app.name);
  }

  if (drift.length > 0) {
    throw new Error(
      `DigitalOcean app drift: ${drift.map((entry) => entry.path).join(',')}`
    );
  }

  logger.log(
    `READY: DigitalOcean app drift clean for ${checkedApps.join(',')}`
  );
  return { checkedApps, drift };
}

function manifestArgument(argv) {
  const index = argv.indexOf('--manifest');
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value) throw new Error('--manifest requires a path.');
  return value;
}

function main() {
  const manifestPath = manifestArgument(process.argv.slice(2));
  runDigitalOceanDriftCheck({
    manifest: manifestPath
      ? loadDigitalOceanAppManifest(manifestPath)
      : loadDigitalOceanAppManifest(),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || error);
    process.exit(1);
  }
}
