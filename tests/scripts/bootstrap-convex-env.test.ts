import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapConvexEnv,
  buildHostedConvexDeployArgs,
  buildConvexEnvBootstrapPlan,
  deployHostedConvex,
  deriveClerkIssuerDomain,
  resolveHostedConvexDeployMode,
  resolveConvexEnvTarget,
  runHostedBuildCommand,
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
        bin: 'pnpm',
        args: [
          'exec',
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
        bin: 'pnpm',
        args: [
          'exec',
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
      'exec',
      'convex',
      'deploy',
      '--cmd',
      'pnpm run build:check',
      '--preview-create',
      'codex/canary-local-ci-agentic-qa',
    ]);
  });

  it('runs the hosted build command directly when preview deploys are compile-only', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    const result = deployHostedConvex({
      env: env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(result).toEqual(['sh', '-lc', 'pnpm run build:check']);
    expect(calls).toEqual([
      {
        bin: 'sh',
        args: ['-lc', 'pnpm run build:check'],
      },
    ]);
  });

  it('fails fast when hosted production builds are missing CONVEX_DEPLOY_KEY', () => {
    expect(() =>
      deployHostedConvex({
        env: env({
          VERCEL_ENV: 'production',
        }),
        runner: vi.fn(),
        logger: { log: vi.fn() },
      })
    ).toThrow(/missing CONVEX_DEPLOY_KEY/);
  });

  it('fails fast when hosted preview builds point at a production deploy key', () => {
    expect(() =>
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        })
      )
    ).toThrow(/preview builds cannot use a production CONVEX_DEPLOY_KEY/);
  });

  it('fails fast when hosted production builds point at a preview deploy key', () => {
    expect(() =>
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'production',
        })
      )
    ).toThrow(/production builds cannot use a preview CONVEX_DEPLOY_KEY/);
  });

  it('bootstraps env before running the hosted Convex deploy for production builds', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    deployHostedConvex({
      env: env({
        CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
        VERCEL_ENV: 'production',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'live',
          'clerk.linejam.app'
        ),
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(calls).toEqual([
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--prod',
          'set',
          'GUEST_TOKEN_SECRET',
          'guest-secret',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--prod',
          'set',
          'CLERK_JWT_ISSUER_DOMAIN',
          'https://clerk.linejam.app',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'deploy',
          '--cmd',
          'pnpm run build:check',
          '--prod',
        ],
      },
    ]);
    expect(calls.at(-1)).toEqual({
      bin: 'pnpm',
      args: [
        'exec',
        'convex',
        'deploy',
        '--cmd',
        'pnpm run build:check',
        '--prod',
      ],
    });
  });

  it('can force hosted preview builds to deploy Convex explicitly', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    const result = deployHostedConvex({
      env: env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
        LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY: '1',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(result).toEqual([
      'exec',
      'convex',
      'deploy',
      '--cmd',
      'pnpm run build:check',
      '--preview-create',
      'codex/canary-local-ci-agentic-qa',
    ]);
    expect(calls.at(-1)).toEqual({
      bin: 'pnpm',
      args: [
        'exec',
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

  it('resolves hosted preview builds to build-only mode by default', () => {
    expect(
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          VERCEL_ENV: 'preview',
        })
      )
    ).toEqual({
      kind: 'build-only',
      reason: 'preview-build',
    });
  });

  it('treats non-hosted builds without deploy credentials as build-only', () => {
    expect(resolveHostedConvexDeployMode(env({}))).toEqual({
      kind: 'build-only',
      reason: 'missing-deploy-key',
    });
  });

  it('runs the hosted build command via the shell', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    expect(
      runHostedBuildCommand({
        env: env({}),
        runner,
      })
    ).toEqual(['sh', '-lc', 'pnpm run build:check']);

    expect(calls).toEqual([
      {
        bin: 'sh',
        args: ['-lc', 'pnpm run build:check'],
      },
    ]);
  });

  it('executes the CLI bootstrap path without a temporal dead zone crash', () => {
    const tempDir = mkdtempSync(
      join(tmpdir(), 'linejam-bootstrap-convex-env-')
    );
    const fakePnpm = join(tempDir, 'pnpm');
    const logPath = join(tempDir, 'pnpm.log');

    try {
      writeFileSync(
        fakePnpm,
        `#!/bin/sh
printf '%s\n' "$*" >> "${logPath}"
exit 0
`
      );
      chmodSync(fakePnpm, 0o755);

      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'scripts/ci/bootstrap-convex-env.mjs')],
        {
          env: {
            ...process.env,
            PATH: `${tempDir}:${process.env.PATH ?? ''}`,
            CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
            VERCEL_ENV: 'preview',
            VERCEL_GIT_COMMIT_REF: 'codex/canary-local-ci-agentic-qa',
            GUEST_TOKEN_SECRET: 'guest-secret',
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
              'test',
              'solid-beetle-24.clerk.accounts.dev'
            ),
          },
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(readFileSync(logPath, 'utf8').trim().split('\n')).toEqual([
        'exec convex env --preview-name codex/canary-local-ci-agentic-qa set GUEST_TOKEN_SECRET guest-secret',
        'exec convex env --preview-name codex/canary-local-ci-agentic-qa set CLERK_JWT_ISSUER_DOMAIN https://solid-beetle-24.clerk.accounts.dev',
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
