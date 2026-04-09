#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {Record<string, string | undefined>} EnvShape
 * @typedef {(command: string, args: string[], options: import('node:child_process').SpawnSyncOptions) => { status: number | null }} Runner
 * @typedef {{ log: (...args: unknown[]) => void }} BootstrapLogger
 */

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

/**
 * @param {EnvShape} [env]
 */
export function resolveConvexEnvTarget(env = process.env) {
  const deployKey = env.CONVEX_DEPLOY_KEY?.trim() || '';
  if (!deployKey) {
    return {
      status: 'skipped',
      reason: 'missing-deploy-key',
      args: [],
    };
  }

  const vercelEnv = env.VERCEL_ENV?.trim() || '';
  if (vercelEnv === 'production' || deployKey.startsWith('prod:')) {
    return {
      status: 'prod',
      args: ['--prod'],
    };
  }

  if (vercelEnv === 'preview' || deployKey.startsWith('preview:')) {
    const previewName =
      env.VERCEL_GIT_COMMIT_REF?.trim() ||
      env.GITHUB_HEAD_REF?.trim() ||
      env.GITHUB_REF_NAME?.trim() ||
      '';

    if (!previewName) {
      throw new Error(
        'Preview Convex deploy detected but no preview branch name was provided. Set VERCEL_GIT_COMMIT_REF, GITHUB_HEAD_REF, or GITHUB_REF_NAME.'
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

  return {
    target,
    entries: [
      ['GUEST_TOKEN_SECRET', guestTokenSecret],
      ['CLERK_JWT_ISSUER_DOMAIN', clerkIssuerDomain],
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
    const result = runner(
      'npx',
      ['convex', 'env', ...plan.target.args, 'set', name, value],
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

async function main() {
  bootstrapConvexEnv();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
