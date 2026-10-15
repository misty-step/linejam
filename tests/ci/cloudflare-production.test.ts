import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';
import { parse } from 'yaml';
import manifest from '@/config/convex-env-manifest.json';

const BACKEND_URL = 'https://linejam.mistystep.io/backend';
// cloudflare/backend.ts derives these from the Worker's own bindings.
const DERIVED = new Map([
  ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN'],
  ['SENTRY_RELEASE', 'NEXT_DEPLOYMENT_ID'],
]);

const release = parse(
  readFileSync('.github/workflows/cloudflare-production.yml', 'utf8')
);
const step: { env: Record<string, string>; run: string } =
  release.jobs.deploy.steps.find((step: { run?: string }) =>
    step.run?.includes('pnpm build:cf')
  );
const { vars } = unstable_readConfig({
  config: 'wrangler.jsonc',
  env: 'production',
});

describe('Cloudflare Production release (ADR-0011)', () => {
  it('bakes, serves and runs the backend at one /backend URL, deploying nothing to Convex', () => {
    expect(step.env.NEXT_PUBLIC_CONVEX_URL).toBe(BACKEND_URL);
    expect(vars.NEXT_PUBLIC_CONVEX_URL).toBe(BACKEND_URL);
    expect(vars.CONVEX_CLOUD_URL).toBe(BACKEND_URL);
    expect(
      Object.keys(step.env).filter((name) => name.startsWith('CONVEX_'))
    ).toEqual([]);
    expect(step.run).not.toMatch(/build:release|convex deploy/);
  });

  it('binds every name the production backend requires before it goes live', () => {
    const names = step.run.match(/const names = \[([^\]]*)\]/)?.[1] ?? '';
    const secrets = [...names.matchAll(/'([A-Z0-9_]+)'/g)].map(
      ([, name]) => name
    );
    expect(secrets).toContain('GUEST_TOKEN_SECRET');
    const bound = new Set([...Object.keys(vars), ...secrets]);
    if (step.run.includes('NEXT_DEPLOYMENT_ID:'))
      bound.add('NEXT_DEPLOYMENT_ID');
    const unbound = manifest.environments.production.required.filter(
      (name) => !bound.has(DERIVED.get(name) ?? name)
    );
    expect(unbound).toEqual([]);
  });
});
