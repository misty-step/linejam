import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapConvexEnv,
  buildHostedConvexDeployArgs,
  buildConvexEnvBootstrapPlan,
  deployHostedConvex,
  deriveClerkIssuerDomain,
  resolveConvexEnvTarget,
} from '@/scripts/ci/bootstrap-convex-env.mjs';

describe('bootstrap-convex-env', () => {
  const env = (entries: Record<string, string>): NodeJS.ProcessEnv =>
    entries as NodeJS.ProcessEnv;
  const clerkPublishableKey = (kind: 'test' | 'live', issuerDomain: string) =>
    ['pk', kind, Buffer.from(issuerDomain).toString('base64url')].join('_');

  it('derives a Clerk issuer domain from the publishable key when needed', () => {
    expect(
      deriveClerkIssuerDomain(
        env({
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'test',
            'solid-beetle-24.clerk.accounts.dev'
          ),
        })
      )
    ).toBe('https://solid-beetle-24.clerk.accounts.dev');
  });

  it('targets the named preview deployment for Vercel preview builds', () => {
    expect(
      resolveConvexEnvTarget(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        })
      )
    ).toEqual({
      status: 'preview',
      args: ['--preview-name', 'codex/canary-local-ci-agentic-qa'],
    });
  });

  it('builds the hosted bootstrap plan with guest token and Clerk issuer', () => {
    expect(
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'test',
            'solid-beetle-24.clerk.accounts.dev'
          ),
          CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
        })
      )
    ).toEqual({
      target: {
        status: 'preview',
        args: ['--preview-name', 'codex/canary-local-ci-agentic-qa'],
      },
      entries: [
        ['GUEST_TOKEN_SECRET', 'guest-secret'],
        [
          'CLERK_JWT_ISSUER_DOMAIN',
          'https://solid-beetle-24.clerk.accounts.dev',
        ],
      ],
    });
  });

  it('seeds both required env vars into the hosted Convex target', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    bootstrapConvexEnv({
      env: env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(calls).toEqual([
      {
        bin: 'npx',
        args: [
          'convex',
          'env',
          '--preview-name',
          'codex/canary-local-ci-agentic-qa',
          'set',
          'GUEST_TOKEN_SECRET',
          'guest-secret',
        ],
      },
      {
        bin: 'npx',
        args: [
          'convex',
          'env',
          '--preview-name',
          'codex/canary-local-ci-agentic-qa',
          'set',
          'CLERK_JWT_ISSUER_DOMAIN',
          'https://solid-beetle-24.clerk.accounts.dev',
        ],
      },
    ]);
  });

  it('rejects a non-preview issuer mismatch instead of deploying drift', () => {
    expect(() =>
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          VERCEL_ENV: 'production',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'live',
            'clerk.linejam.app'
          ),
          CLERK_JWT_ISSUER_DOMAIN: 'https://solid-beetle-24.clerk.accounts.dev',
        })
      )
    ).toThrow(/does not match the active Clerk publishable key/);
  });

  it('pins hosted preview deploys to the same preview branch name', () => {
    expect(
      buildHostedConvexDeployArgs(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        })
      )
    ).toEqual([
      'convex',
      'deploy',
      '--cmd',
      'pnpm run build:check',
      '--preview-create',
      'codex/canary-local-ci-agentic-qa',
    ]);
  });

  it('bootstraps env before running the hosted Convex deploy', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    deployHostedConvex({
      env: env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(calls.at(-1)).toEqual({
      bin: 'npx',
      args: [
        'convex',
        'deploy',
        '--cmd',
        'pnpm run build:check',
        '--preview-create',
        'codex/canary-local-ci-agentic-qa',
      ],
    });
  });

  it('fails fast when preview deploys have no branch name', () => {
    expect(() =>
      resolveConvexEnvTarget(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'preview',
        })
      )
    ).toThrow(/preview branch name/);
  });
});
