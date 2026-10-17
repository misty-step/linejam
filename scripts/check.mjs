#!/usr/bin/env node
// Copy the native Overmind pattern: one portable command; the caller owns
// installation, source-bound logs and compute isolation, not a hosted vendor.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export function checkPlan(mode) {
  if (mode !== 'fast' && mode !== 'full') {
    throw new Error('Expected --mode fast or full.');
  }
  const quality = [
    'test:train',
    'test:rust',
    'provider-retirement:check',
    'typecheck',
    'lint',
  ];
  return mode === 'fast'
    ? [...quality, 'test']
    : [
        'format:check',
        ...quality,
        'test:ci',
        'backend:modules:check',
        'test:backend:cloudflare',
        'build:cf',
        'test:worker-routes',
        'test:worker-images',
        'test:worker-routes --game',
        'test:worker-routes --telemetry',
        'test:worker-routes --party',
      ];
}

export function isolatedEnvironment(environment, source) {
  // Refuse live credentials instead of quietly changing a live operation into
  // a fixture run. No source, credential or deployment configuration is changed.
  for (const name of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_DEPLOY_KEY_PROD',
    'CONVEX_OVERRIDE_ACCESS_TOKEN',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
    'CLERK_SECRET_KEY',
    'CLOUDFLARE_API_TOKEN',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_RELEASE_TOKEN',
    'OPENROUTER_API_KEY',
    'GUEST_TOKEN_SECRET',
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'LINEJAM_BACKEND_ADMIN_KEY',
    'CONVEX_DEPLOYMENT',
  ]) {
    if (environment[name]) throw new Error(`Isolated checks refuse ${name}.`);
  }
  return {
    ...environment,
    CI: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    WRANGLER_SEND_METRICS: 'false',
    LINEJAM_LOCAL: '1',
    NEXT_PUBLIC_LINEJAM_LOCAL: '1',
    LINEJAM_DEPLOY_ENVIRONMENT: 'development',
    NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:8787/backend',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_SENTRY_ENABLED: '0',
    NEXT_PUBLIC_POSTHOG_KEY: '',
    LINEJAM_SENTRY_ENABLED: 'false',
    GUEST_TOKEN_SECRET: 'isolated-worker-image-build-only-0000000000',
    NEXT_DEPLOYMENT_ID: source,
    CIRCLE_NODE_TOTAL: '2',
  };
}

export function sourceRevision(root) {
  const identity = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  // Source archives have no revision; their caller retains the snapshot identity.
  return identity.status === 0 ? identity.stdout.trim() : null;
}

export function runChecks(root, mode, environment = process.env) {
  const plan = checkPlan(mode);
  // Next and Wrangler discover dotenv files themselves, after our environment
  // check. Refuse discovery without ever reading the credential-bearing files.
  if (
    readdirSync(root).some(
      (name) =>
        name === '.env' ||
        (name.startsWith('.env.') &&
          !['.env.example', '.env.pass'].includes(name)) ||
        name.startsWith('.dev.vars')
    )
  )
    throw new Error(
      'Isolated checks refuse dotenv files. Use a clean checkout.'
    );
  // The existing local Docker checker consumes a source archive without .git.
  // Its snapshot receipt owns identity there; absence of Git is not a new gate.
  const source = sourceRevision(root) ?? '';
  const env = isolatedEnvironment(environment, source);
  const toolEnv = { ...env };
  // Unit tests deliberately exercise both local and hosted behavior. As in the
  // existing local checker, fixture flags belong only to build/runtime steps.
  for (const name of [
    'LINEJAM_LOCAL',
    'NEXT_PUBLIC_LINEJAM_LOCAL',
    'LINEJAM_DEPLOY_ENVIRONMENT',
    'NEXT_PUBLIC_CONVEX_URL',
    'NEXT_PUBLIC_SENTRY_ENABLED',
    'LINEJAM_SENTRY_ENABLED',
    'GUEST_TOKEN_SECRET',
  ])
    delete toolEnv[name];
  console.log(
    `Linejam native checks: source=${source || 'unversioned (retain caller snapshot)'} mode=${mode}`
  );
  for (const script of plan) {
    const [name, ...args] = script.split(' ');
    console.log(`\n> pnpm ${script}`);
    const result = spawnSync('pnpm', [name, ...args], {
      cwd: root,
      env:
        name === 'build:cf' || name.startsWith('test:worker-') ? env : toolEnv,
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        `pnpm ${script} failed (${result.signal ?? result.status}).`
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { mode: { type: 'string', default: 'full' } },
    });
    runChecks(dirname(dirname(fileURLToPath(import.meta.url))), values.mode);
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
