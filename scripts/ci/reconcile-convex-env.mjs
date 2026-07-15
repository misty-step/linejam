#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveConvexEnvTarget } from './bootstrap-convex-env.mjs';

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const ENVIRONMENTS = ['development', 'preview', 'production'];
const DEFAULT_MANIFEST_URL = new URL(
  '../../config/convex-env-manifest.json',
  import.meta.url
);

/** @typedef {'development' | 'preview' | 'production'} ManifestEnvironment */
/** @typedef {{ required: string[], optional: string[] }} ManifestEntry */
/** @typedef {{ schemaVersion: 1, environments: Record<ManifestEnvironment, ManifestEntry> }} ConvexEnvManifest */
/** @typedef {{ status: 'skipped' | 'default' | 'preview' | 'prod', reason?: string, args: string[], explicit?: boolean }} ConvexEnvTarget */
/** @typedef {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptionsWithStringEncoding) => { status: number | null, stdout?: string, stderr?: string }} Runner */

/**
 * The manifest contains names only. Rejecting every other shape prevents this
 * reconciliation surface from becoming a place where secret values can land.
 *
 * @param {unknown} candidate
 * @returns {ConvexEnvManifest}
 */
export function validateConvexEnvManifest(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Convex env manifest must be an object.');
  }

  const manifest = /** @type {Record<string, unknown>} */ (candidate);
  assertExactKeys('Convex env manifest', manifest, [
    'schemaVersion',
    'environments',
  ]);
  if (manifest.schemaVersion !== 1) {
    throw new Error('Convex env manifest schemaVersion must be 1.');
  }

  if (!manifest.environments || typeof manifest.environments !== 'object') {
    throw new Error('Convex env manifest must declare environments.');
  }

  const environments = /** @type {Record<string, unknown>} */ (
    manifest.environments
  );
  assertExactKeys(
    'Convex env manifest environments',
    environments,
    ENVIRONMENTS
  );
  for (const environment of ENVIRONMENTS) {
    validateManifestEntry(environment, environments[environment]);
  }

  return /** @type {ConvexEnvManifest} */ (candidate);
}

/**
 * @param {string} environment
 * @param {unknown} candidate
 */
function validateManifestEntry(environment, candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Convex env manifest must declare ${environment}.`);
  }

  const entry = /** @type {Record<string, unknown>} */ (candidate);
  assertExactKeys(`Convex env manifest ${environment}`, entry, [
    'required',
    'optional',
  ]);
  for (const field of ['required', 'optional']) {
    const names = entry[field];
    if (!Array.isArray(names)) {
      throw new Error(
        `Convex env manifest ${environment}.${field} must be an array.`
      );
    }
    if (
      !names.every(
        (name) => typeof name === 'string' && ENV_NAME_PATTERN.test(name)
      )
    ) {
      throw new Error(
        `Convex env manifest ${environment}.${field} must contain environment variable names only.`
      );
    }
    if (new Set(names).size !== names.length) {
      throw new Error(
        `Convex env manifest ${environment}.${field} contains duplicate names.`
      );
    }
  }

  const required = /** @type {string[]} */ (entry.required);
  const optional = new Set(/** @type {string[]} */ (entry.optional));
  if (required.some((name) => optional.has(name))) {
    throw new Error(
      `Convex env manifest ${environment} cannot list a name as both required and optional.`
    );
  }
}

/**
 * @param {string} label
 * @param {Record<string, unknown>} candidate
 * @param {string[]} expected
 */
function assertExactKeys(label, candidate, expected) {
  const actual = Object.keys(candidate).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    throw new Error(`${label} contains unsupported fields.`);
  }
}

/**
 * @param {string | URL} [path]
 * @returns {ConvexEnvManifest}
 */
export function loadConvexEnvManifest(path = DEFAULT_MANIFEST_URL) {
  return validateConvexEnvManifest(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * Parse only the stdout of `convex env ... list --names-only`. Never include
 * rejected output in an exception: a provider regression must not echo values.
 *
 * @param {string} output
 * @returns {string[]}
 */
export function parseConvexEnvNames(output) {
  const names = output
    .split(/\r?\n/u)
    .map((name) => name.trim())
    .filter(Boolean);

  if (!names.every((name) => ENV_NAME_PATTERN.test(name))) {
    throw new Error('Convex env names-only output contained a non-name entry.');
  }

  return [...new Set(names)].sort();
}

/**
 * @param {ManifestEntry} entry
 * @param {string[]} liveNames
 */
export function diffConvexEnvNames(entry, liveNames) {
  const live = new Set(liveNames);
  const allowed = new Set([...entry.required, ...entry.optional]);

  return {
    missing: entry.required.filter((name) => !live.has(name)).sort(),
    unexpected: liveNames.filter((name) => !allowed.has(name)).sort(),
  };
}

/**
 * @param {ConvexEnvTarget['status']} status
 * @returns {ManifestEnvironment}
 */
function manifestEnvironmentForTarget(status) {
  if (status === 'prod') return 'production';
  if (status === 'preview') return 'preview';
  if (status === 'default') return 'development';
  throw new Error('Cannot reconcile a skipped Convex environment target.');
}

/**
 * @param {{
 *   target: ConvexEnvTarget;
 *   manifest?: ConvexEnvManifest;
 *   runner?: Runner;
 *   logger?: { log: (message: string) => void };
 *   env?: NodeJS.ProcessEnv;
 * }} options
 */
export function runConvexEnvReconciliation({
  target,
  manifest = loadConvexEnvManifest(),
  runner = spawnSync,
  logger = console,
  env = process.env,
}) {
  const environment = manifestEnvironmentForTarget(target.status);
  const validatedManifest = validateConvexEnvManifest(manifest);
  const childEnv = { ...env };
  if (target.explicit) delete childEnv.CONVEX_DEPLOY_KEY;
  const result = runner(
    'pnpm',
    ['exec', 'convex', 'env', ...target.args, 'list', '--names-only'],
    { encoding: 'utf8', env: childEnv }
  );

  if (result.status !== 0) {
    throw new Error(
      `Convex ${environment} names-only read failed with status ${result.status ?? 'unknown'}.`
    );
  }

  const liveNames = parseConvexEnvNames(result.stdout ?? '');
  const entry = validatedManifest.environments[environment];
  const diff = diffConvexEnvNames(entry, liveNames);
  if (diff.missing.length > 0 || diff.unexpected.length > 0) {
    throw new Error(
      `Convex ${environment} environment drift: missing=${formatNames(diff.missing)}; unexpected=${formatNames(diff.unexpected)}`
    );
  }

  logger.log(
    `READY: Convex ${environment} env manifest required=${entry.required.join(',') || 'none'}; optional_present=${liveNames.filter((name) => entry.optional.includes(name)).join(',') || 'none'}`
  );

  return { environment, liveNames, ...diff };
}

/** @param {string[]} names */
function formatNames(names) {
  return names.length > 0 ? names.join(',') : 'none';
}

function manifestArgument(argv) {
  const index = argv.indexOf('--manifest');
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value) throw new Error('--manifest requires a path.');
  return value;
}

/**
 * Explicit targets are for bounded operator/readback commands. Hosted deploys
 * omit the flag and remain pinned to the deploy-key target resolved by the
 * production build policy.
 *
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {ConvexEnvTarget}
 */
export function resolveReconciliationTarget(argv, env = process.env) {
  const index = argv.indexOf('--target');
  if (index === -1) return resolveConvexEnvTarget(env);

  const target = argv[index + 1];
  if (target === 'development') {
    return { status: 'default', args: [], explicit: true };
  }
  if (target === 'production') {
    return { status: 'prod', args: ['--prod'], explicit: true };
  }
  if (target === 'preview') {
    const previewIndex = argv.indexOf('--preview-name');
    if (previewIndex === -1 || !argv[previewIndex + 1]) {
      throw new Error('--target preview requires --preview-name.');
    }
    const previewName = argv[previewIndex + 1];
    return {
      status: 'preview',
      args: ['--preview-name', previewName],
      explicit: true,
    };
  }

  throw new Error('--target must be development, preview, or production.');
}

function main() {
  const argv = process.argv.slice(2);
  const target = resolveReconciliationTarget(argv);
  runConvexEnvReconciliation({
    target,
    manifest: loadConvexEnvManifest(manifestArgument(argv)),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Convex env reconciliation failed.'
    );
    process.exitCode = 1;
  }
}
