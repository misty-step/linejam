#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {Record<string, string | undefined>} EnvShape
 * @typedef {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptions) => { status: number | null }} Runner
 * @typedef {{ log: (...args: unknown[]) => void }} BootstrapLogger
 */

const CONVEX_EXECUTABLE = ['pnpm', ['exec', 'convex']];

/**
 * @param {EnvShape} [env]
 */
export function deriveClerkIssuerDomain(env = process.env) {
  const publishableKey =
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    env.CLERK_PUBLISHABLE_KEY?.trim() ||
    '';
  if (!publishableKey) {
    return '';
  }

  const encodedDomain = publishableKey.split('_').at(-1);
  if (!encodedDomain) {
    return '';
  }

  try {
    const decoded = Buffer.from(encodedDomain, 'base64url')
      .toString('utf8')
      .replace(/\$+$/, '');

    if (!decoded) {
      return '';
    }

    return decoded.startsWith('https://') ? decoded : `https://${decoded}`;
  } catch {
    return '';
  }
}

function normalizeIssuer(value) {
  return value.trim().replace(/\/+$/, '');
}

function resolveHostedClerkIssuerDomain(env, target) {
  const explicitIssuer = env.CLERK_JWT_ISSUER_DOMAIN?.trim() || '';
  const derivedIssuer = deriveClerkIssuerDomain(env);

  if (target.status === 'preview' && derivedIssuer) {
    return derivedIssuer;
  }

  if (
    target.status !== 'preview' &&
    explicitIssuer &&
    derivedIssuer &&
    normalizeIssuer(explicitIssuer) !== normalizeIssuer(derivedIssuer)
  ) {
    throw new Error(
      'CLERK_JWT_ISSUER_DOMAIN does not match the active Clerk publishable key. Fix the hosted env so Convex auth and Clerk stay aligned.'
    );
  }

  return explicitIssuer || derivedIssuer;
}

function resolveDeployKeyTarget(deployKey) {
  if (deployKey.startsWith('prod:')) {
    return 'prod';
  }

  if (deployKey.startsWith('preview:')) {
    return 'preview';
  }

  return 'default';
}

/**
 * @param {EnvShape} [env]
 */
function assertHostedDeploySignalsCompatible(env = process.env) {
  const deployKey = env.CONVEX_DEPLOY_KEY?.trim() || '';
  const environment = env.LINEJAM_DEPLOY_ENVIRONMENT?.trim() || '';
  const deployKeyTarget = resolveDeployKeyTarget(deployKey);

  if (environment === 'production' && !deployKey) {
    throw new Error(
      'Hosted production builds require CONVEX_DEPLOY_KEY. Refusing to ship frontend code against stale backend auth config.'
    );
  }

  if (environment === 'preview' && deployKeyTarget === 'prod') {
    throw new Error(
      'Hosted preview builds cannot use a production CONVEX_DEPLOY_KEY.'
    );
  }

  if (environment === 'production' && deployKeyTarget === 'preview') {
    throw new Error(
      'Hosted production builds cannot use a preview CONVEX_DEPLOY_KEY.'
    );
  }
}

/**
 * @param {EnvShape} [env]
 */
export function resolveHostedConvexDeployMode(env = process.env) {
  assertHostedDeploySignalsCompatible(env);

  const deployKey = env.CONVEX_DEPLOY_KEY?.trim() || '';
  if (!deployKey) {
    return {
      kind: 'build-only',
      reason: 'missing-deploy-key',
    };
  }

  if (
    resolveDeployKeyTarget(deployKey) === 'preview' &&
    env.LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY?.trim() !== '1'
  ) {
    return {
      kind: 'build-only',
      reason: 'preview-build',
    };
  }

  return {
    kind: 'deploy-convex',
    reason: 'hosted-deploy',
  };
}

/**
 * @param {EnvShape} [env]
 */
export function resolveConvexEnvTarget(env = process.env) {
  assertHostedDeploySignalsCompatible(env);

  const deployKey = env.CONVEX_DEPLOY_KEY?.trim() || '';
  if (!deployKey) {
    return {
      status: 'skipped',
      reason: 'missing-deploy-key',
      args: [],
    };
  }

  if (deployKey.startsWith('prod:')) {
    return {
      status: 'prod',
      args: ['--prod'],
    };
  }

  if (deployKey.startsWith('preview:')) {
    const previewName =
      env.GITHUB_HEAD_REF?.trim() || env.GITHUB_REF_NAME?.trim() || '';

    if (!previewName) {
      throw new Error(
        'Preview Convex deploy detected but no preview branch name was provided. Set GITHUB_HEAD_REF or GITHUB_REF_NAME.'
      );
    }

    return {
      status: 'preview',
      args: ['--preview-name', previewName],
    };
  }

  return {
    status: 'default',
    args: [],
  };
}

/**
 * @param {EnvShape} [env]
 */
export function buildConvexEnvBootstrapPlan(env = process.env) {
  const target = resolveConvexEnvTarget(env);
  if (target.status === 'skipped') {
    return {
      target,
      entries: [],
    };
  }

  const guestTokenSecret = env.GUEST_TOKEN_SECRET?.trim() || '';
  if (!guestTokenSecret) {
    throw new Error(
      'GUEST_TOKEN_SECRET is required before deploying hosted Convex environments.'
    );
  }

  const clerkIssuerDomain = resolveHostedClerkIssuerDomain(env, target);
  if (!clerkIssuerDomain) {
    throw new Error(
      'CLERK_JWT_ISSUER_DOMAIN is required before deploying hosted Convex environments. Set it explicitly or provide a Clerk publishable key so it can be derived.'
    );
  }

  const deploymentEnvironment =
    target.status === 'prod'
      ? 'production'
      : target.status === 'preview'
        ? 'preview'
        : 'development';

  return {
    target,
    entries: [
      ['GUEST_TOKEN_SECRET', guestTokenSecret],
      ['CLERK_JWT_ISSUER_DOMAIN', clerkIssuerDomain],
      ['LINEJAM_DEPLOY_ENVIRONMENT', deploymentEnvironment],
    ],
  };
}

/**
 * @param {{
 *   env?: EnvShape;
 *   runner?: Runner;
 *   logger?: BootstrapLogger;
 * }} [options]
 */
export function bootstrapConvexEnv({
  env = process.env,
  runner = spawnSync,
  logger = console,
} = {}) {
  const plan = buildConvexEnvBootstrapPlan(env);
  if (plan.target.status === 'skipped') {
    logger.log(
      'Skipping hosted Convex env bootstrap because CONVEX_DEPLOY_KEY is not set.'
    );
    return plan;
  }

  for (const [name, value] of plan.entries) {
    const [command, prefixArgs] = CONVEX_EXECUTABLE;
    const result = runner(
      command,
      [...prefixArgs, 'env', ...plan.target.args, 'set', name, value],
      {
        stdio: 'inherit',
        env,
      }
    );

    if (result.status !== 0) {
      throw new Error(
        `Failed to seed ${name} for the hosted Convex ${plan.target.status} deployment.`
      );
    }
  }

  return plan;
}

/**
 * @param {EnvShape} [env]
 * @param {string} [buildCommand]
 */
export function buildHostedConvexDeployArgs(
  env = process.env,
  buildCommand = 'pnpm run build:check'
) {
  const target = resolveConvexEnvTarget(env);
  const args = ['exec', 'convex', 'deploy', '--cmd', buildCommand];

  if (target.status === 'preview') {
    const previewName = target.args[1];
    if (previewName) {
      args.push('--preview-create', previewName);
    }
  }

  return args;
}

/**
 * @param {{
 *   env?: EnvShape;
 *   runner?: Runner;
 *   buildCommand?: string;
 * }} [options]
 */
export function runHostedBuildCommand({
  env = process.env,
  runner = spawnSync,
  buildCommand = 'pnpm run build:check',
} = {}) {
  const result = runner('sh', ['-lc', buildCommand], {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    throw new Error(`Hosted build command failed: ${buildCommand}`);
  }

  return ['sh', '-lc', buildCommand];
}

/**
 * @param {{
 *   env?: EnvShape;
 *   runner?: Runner;
 *   logger?: BootstrapLogger;
 *   buildCommand?: string;
 * }} [options]
 */
export function deployHostedConvex({
  env = process.env,
  runner = spawnSync,
  logger = console,
  buildCommand = 'pnpm run build:check',
} = {}) {
  const deployMode = resolveHostedConvexDeployMode(env);
  if (deployMode.kind === 'build-only') {
    logger.log(
      `Skipping hosted Convex deploy for ${deployMode.reason}; running ${buildCommand} only.`
    );
    return runHostedBuildCommand({ env, runner, buildCommand });
  }

  bootstrapConvexEnv({ env, runner, logger });

  const args = buildHostedConvexDeployArgs(env, buildCommand);
  const result = runner('pnpm', args, {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    throw new Error('Hosted Convex deploy failed.');
  }

  runPostDeployVerification({
    env,
    target: resolveConvexEnvTarget(env),
    runner,
  });

  return args;
}

/**
 * App Platform does not activate the build until this process exits. Keep the
 * values-free name reconciliation and zero-write guest-secret parity probe in
 * this unskippable post-deploy path so frontend traffic cannot race stale or
 * mismatched Convex configuration.
 *
 * @param {{ env: EnvShape; target: ReturnType<typeof resolveConvexEnvTarget>; runner: Runner }} options
 */
function runPostDeployVerification({ env, target, runner }) {
  const reconcile = runner('node', ['scripts/ci/reconcile-convex-env.mjs'], {
    stdio: 'inherit',
    env,
  });
  if (reconcile.status !== 0) {
    throw new Error('Hosted Convex environment reconciliation failed.');
  }

  if (target.status !== 'prod') return;

  const parity = runner(
    'node',
    ['scripts/convex/probe-signed-throttle-ready.mjs'],
    { stdio: 'inherit', env }
  );
  if (parity.status !== 0) {
    throw new Error('Hosted guest-token secret parity verification failed.');
  }
}

async function main() {
  if (process.argv.includes('--deploy')) {
    deployHostedConvex();
    return;
  }

  bootstrapConvexEnv();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
