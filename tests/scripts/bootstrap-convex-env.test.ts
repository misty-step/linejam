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
  const env = (entries: Record<string, string>): NodeJS.ProcessEnv => ({
    NODE_ENV: 'test',
    ...entries,
  });
  const clerkPublishableKey = (kind: 'test' | 'live', issuerDomain: string) =>
    ['pk', kind, Buffer.from(issuerDomain).toString('base64url')].join('_');
  const sentryEnv = {
    NEXT_PUBLIC_SENTRY_ENABLED: '1',
    NEXT_PUBLIC_SENTRY_DSN: ['https://public', 'sentry.example/1'].join('@'),
    NEXT_DEPLOYMENT_ID: 'a'.repeat(40),
  };
  const bridgeSecrets = {
    SENTRY_WEBHOOK_SECRET: 'webhook-secret',
    SENTRY_EVENT_WRITE_TOKEN: 'event-write-token',
    SENTRY_AUTOMATION_PROVENANCE_SECRET:
      'automation-provenance-secret-at-least-32-characters',
    GITHUB_ISSUES_TOKEN: 'github-issues-token',
    SENTRY_AGENT_LOOP_SECRET: 'agent-loop-secret-at-least-32-characters',
  };

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

  it('targets the named preview deployment from its deploy key and GitHub branch', () => {
    expect(
      resolveConvexEnvTarget(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          GITHUB_HEAD_REF: 'codex/sentry-cutover',
        })
      )
    ).toEqual({
      status: 'preview',
      args: ['--preview-name', 'codex/sentry-cutover'],
    });
  });

  it('builds the hosted bootstrap plan with guest token and Clerk issuer', () => {
    expect(
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          GITHUB_HEAD_REF: 'codex/sentry-cutover',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'test',
            'solid-beetle-24.clerk.accounts.dev'
          ),
          CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
          ...sentryEnv,
        })
      )
    ).toEqual({
      target: {
        status: 'preview',
        args: ['--preview-name', 'codex/sentry-cutover'],
      },
      entries: [
        ['GUEST_TOKEN_SECRET', 'guest-secret'],
        [
          'CLERK_JWT_ISSUER_DOMAIN',
          'https://solid-beetle-24.clerk.accounts.dev',
        ],
        ['LINEJAM_DEPLOY_ENVIRONMENT', 'preview'],
        ['LINEJAM_SENTRY_ENABLED', 'true'],
        ['SENTRY_DSN', ['https://public', 'sentry.example/1'].join('@')],
        ['SENTRY_ENVIRONMENT', 'preview'],
        ['SENTRY_RELEASE', 'a'.repeat(40)],
      ],
    });
  });

  it('seeds the complete preview issue bridge only when all secrets exist', () => {
    const plan = buildConvexEnvBootstrapPlan(
      env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        GITHUB_HEAD_REF: 'forest/393-sentry-integration',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
        ...sentryEnv,
        SENTRY_WEBHOOK_SECRET: 'webhook-secret',
        SENTRY_EVENT_WRITE_TOKEN: 'event-write-token',
        SENTRY_AUTOMATION_PROVENANCE_SECRET:
          'automation-provenance-secret-at-least-32-characters',
        GITHUB_ISSUES_TOKEN: 'github-issues-token',
      })
    );

    expect(plan.entries.slice(-11)).toEqual([
      ['SENTRY_WEBHOOK_SECRET', 'webhook-secret'],
      ['SENTRY_EVENT_WRITE_TOKEN', 'event-write-token'],
      [
        'SENTRY_AUTOMATION_PROVENANCE_SECRET',
        'automation-provenance-secret-at-least-32-characters',
      ],
      ['GITHUB_ISSUES_TOKEN', 'github-issues-token'],
      ['SENTRY_ORG', 'misty-step'],
      ['SENTRY_EXPECTED_APP_ID', '160944'],
      [
        'SENTRY_EXPECTED_INSTALLATION_UUID',
        '268a6e8e-c341-414e-bee6-20125b9987ef',
      ],
      ['SENTRY_EXPECTED_PROJECT_ID', '4510762050650112'],
      ['SENTRY_GITHUB_INTEGRATION_ID', '338522'],
      ['GITHUB_REPOSITORY_OWNER', 'misty-step'],
      ['GITHUB_REPOSITORY_NAME', 'linejam'],
    ]);
  });

  it('requires the complete issue bridge for production', () => {
    expect(() =>
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'live',
            'clerk.linejam.app'
          ),
          ...sentryEnv,
        })
      )
    ).toThrow(
      'Hosted Sentry-to-GitHub bridge configuration is incomplete or invalid.'
    );
  });

  it('requires a distinct production agent-loop secret', () => {
    const bridgeWithoutAgent = {
      SENTRY_WEBHOOK_SECRET: bridgeSecrets.SENTRY_WEBHOOK_SECRET,
      SENTRY_EVENT_WRITE_TOKEN: bridgeSecrets.SENTRY_EVENT_WRITE_TOKEN,
      SENTRY_AUTOMATION_PROVENANCE_SECRET:
        bridgeSecrets.SENTRY_AUTOMATION_PROVENANCE_SECRET,
      GITHUB_ISSUES_TOKEN: bridgeSecrets.GITHUB_ISSUES_TOKEN,
    };
    expect(() =>
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'live',
            'clerk.linejam.app'
          ),
          ...sentryEnv,
          ...bridgeWithoutAgent,
        })
      )
    ).toThrow(
      'SENTRY_AGENT_LOOP_SECRET must contain at least 32 characters for production.'
    );
  });

  it('rejects one shared webhook and agent-loop secret', () => {
    const sharedSecret = 'shared-production-secret-at-least-32-characters';
    expect(() =>
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'live',
            'clerk.linejam.app'
          ),
          ...sentryEnv,
          ...bridgeSecrets,
          SENTRY_WEBHOOK_SECRET: sharedSecret,
          SENTRY_AGENT_LOOP_SECRET: sharedSecret,
        })
      )
    ).toThrow(
      'SENTRY_AGENT_LOOP_SECRET must differ from SENTRY_WEBHOOK_SECRET.'
    );
  });

  it('seeds every bootstrap env var into the hosted Convex target', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    bootstrapConvexEnv({
      env: env({
        CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        GITHUB_HEAD_REF: 'codex/sentry-cutover',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
        ...sentryEnv,
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
          'codex/sentry-cutover',
          'set',
          'GUEST_TOKEN_SECRET',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'CLERK_JWT_ISSUER_DOMAIN',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'LINEJAM_DEPLOY_ENVIRONMENT',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'LINEJAM_SENTRY_ENABLED',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'SENTRY_DSN',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'SENTRY_ENVIRONMENT',
        ],
      },
      {
        bin: 'pnpm',
        args: [
          'exec',
          'convex',
          'env',
          '--preview-name',
          'codex/sentry-cutover',
          'set',
          'SENTRY_RELEASE',
        ],
      },
    ]);
  });

  it('rejects a non-preview issuer mismatch instead of deploying drift', () => {
    expect(() =>
      buildConvexEnvBootstrapPlan(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
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
          GITHUB_HEAD_REF: 'codex/sentry-cutover',
        })
      )
    ).toEqual([
      'exec',
      'convex',
      'deploy',
      '--cmd',
      'pnpm run build:check',
      '--preview-create',
      'codex/sentry-cutover',
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
        GITHUB_HEAD_REF: 'codex/sentry-cutover',
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

  it('bootstraps env before running the hosted Convex deploy for production builds', () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const runner = (bin: string, args: string[]) => {
      calls.push({ bin, args });
      return { status: 0 };
    };

    deployHostedConvex({
      env: env({
        CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'live',
          'clerk.linejam.app'
        ),
        CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
        ...sentryEnv,
        ...bridgeSecrets,
      }),
      runner,
      logger: { log: vi.fn() },
    });

    expect(
      calls
        .filter(
          ({ bin, args }) =>
            bin === 'pnpm' &&
            args[0] === 'exec' &&
            args[1] === 'convex' &&
            args[2] === 'env'
        )
        .map(({ args }) => args.at(-1))
    ).toEqual([
      'GUEST_TOKEN_SECRET',
      'CLERK_JWT_ISSUER_DOMAIN',
      'LINEJAM_DEPLOY_ENVIRONMENT',
      'LINEJAM_SENTRY_ENABLED',
      'SENTRY_DSN',
      'SENTRY_ENVIRONMENT',
      'SENTRY_RELEASE',
      'SENTRY_WEBHOOK_SECRET',
      'SENTRY_EVENT_WRITE_TOKEN',
      'SENTRY_AUTOMATION_PROVENANCE_SECRET',
      'GITHUB_ISSUES_TOKEN',
      'SENTRY_ORG',
      'SENTRY_EXPECTED_APP_ID',
      'SENTRY_EXPECTED_INSTALLATION_UUID',
      'SENTRY_EXPECTED_PROJECT_ID',
      'SENTRY_GITHUB_INTEGRATION_ID',
      'GITHUB_REPOSITORY_OWNER',
      'GITHUB_REPOSITORY_NAME',
      'SENTRY_AGENT_LOOP_SECRET',
    ]);
    expect(calls.slice(-3)).toEqual([
      {
        bin: 'pnpm',
        args: ['exec', 'convex', 'deploy', '--cmd', 'pnpm run build:check'],
      },
      {
        bin: 'node',
        args: ['scripts/ci/reconcile-convex-env.mjs'],
      },
      {
        bin: 'node',
        args: [
          'scripts/convex/probe-signed-throttle-ready.mjs',
          '--assert-prod-target',
        ],
      },
    ]);
    expect(calls.at(-1)).toEqual({
      bin: 'node',
      args: [
        'scripts/convex/probe-signed-throttle-ready.mjs',
        '--assert-prod-target',
      ],
    });
  });

  it('fails the hosted production build when post-deploy verification fails', () => {
    const runner = vi.fn((bin: string, args: string[]) => ({
      status:
        bin === 'node' && args[0] === 'scripts/ci/reconcile-convex-env.mjs'
          ? 1
          : 0,
    }));

    expect(() =>
      deployHostedConvex({
        env: env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          GUEST_TOKEN_SECRET: 'guest-secret',
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
            'live',
            'clerk.linejam.app'
          ),
          CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
          ...sentryEnv,
          ...bridgeSecrets,
        }),
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow('Hosted Convex environment reconciliation failed');

    expect(runner).not.toHaveBeenCalledWith(
      'node',
      [
        'scripts/convex/probe-signed-throttle-ready.mjs',
        '--assert-prod-target',
      ],
      expect.anything()
    );
    expect(runner).toHaveBeenCalledWith(
      'node',
      ['scripts/ci/reconcile-convex-env.mjs'],
      expect.objectContaining({ timeout: 60_000 })
    );
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
        GITHUB_HEAD_REF: 'codex/sentry-cutover',
        LINEJAM_FORCE_HOSTED_PREVIEW_CONVEX_DEPLOY: '1',
        GUEST_TOKEN_SECRET: 'guest-secret',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
          'test',
          'solid-beetle-24.clerk.accounts.dev'
        ),
        ...sentryEnv,
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
      'codex/sentry-cutover',
    ]);
    expect(calls).toContainEqual({
      bin: 'pnpm',
      args: [
        'exec',
        'convex',
        'deploy',
        '--cmd',
        'pnpm run build:check',
        '--preview-create',
        'codex/sentry-cutover',
      ],
    });
    expect(calls.at(-1)).toEqual({
      bin: 'node',
      args: ['scripts/ci/reconcile-convex-env.mjs'],
    });
  });

  it('fails fast when preview deploys have no branch name', () => {
    expect(() =>
      resolveConvexEnvTarget(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
        })
      )
    ).toThrow(/preview branch name/);
  });

  it('resolves hosted preview builds to build-only mode by default', () => {
    expect(
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
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

  it('fails fast when hosted production builds are missing CONVEX_DEPLOY_KEY', () => {
    expect(() =>
      deployHostedConvex({
        env: env({ LINEJAM_DEPLOY_ENVIRONMENT: 'production' }),
        runner: vi.fn(),
        logger: { log: vi.fn() },
      })
    ).toThrow(/production builds require CONVEX_DEPLOY_KEY/);
  });

  it('fails fast when hosted preview builds point at a production deploy key', () => {
    expect(() =>
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
          LINEJAM_DEPLOY_ENVIRONMENT: 'preview',
        })
      )
    ).toThrow(/preview builds cannot use a production CONVEX_DEPLOY_KEY/);
  });

  it('fails fast when hosted production builds point at a preview deploy key', () => {
    expect(() =>
      resolveHostedConvexDeployMode(
        env({
          CONVEX_DEPLOY_KEY: 'preview:team:project|secret',
          LINEJAM_DEPLOY_ENVIRONMENT: 'production',
        })
      )
    ).toThrow(/production builds cannot use a preview CONVEX_DEPLOY_KEY/);
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
            GITHUB_HEAD_REF: 'codex/sentry-cutover',
            GUEST_TOKEN_SECRET: 'guest-secret',
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
              'test',
              'solid-beetle-24.clerk.accounts.dev'
            ),
            ...sentryEnv,
          },
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const loggedArgs = readFileSync(logPath, 'utf8').trim().split('\n');
      expect(loggedArgs).toEqual([
        'exec convex env --preview-name codex/sentry-cutover set GUEST_TOKEN_SECRET',
        'exec convex env --preview-name codex/sentry-cutover set CLERK_JWT_ISSUER_DOMAIN',
        'exec convex env --preview-name codex/sentry-cutover set LINEJAM_DEPLOY_ENVIRONMENT',
        'exec convex env --preview-name codex/sentry-cutover set LINEJAM_SENTRY_ENABLED',
        'exec convex env --preview-name codex/sentry-cutover set SENTRY_DSN',
        'exec convex env --preview-name codex/sentry-cutover set SENTRY_ENVIRONMENT',
        'exec convex env --preview-name codex/sentry-cutover set SENTRY_RELEASE',
      ]);
      expect(loggedArgs.join('\n')).not.toContain('guest-secret');
      expect(loggedArgs.join('\n')).not.toContain('public@sentry.example');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('executes the CLI deploy path without passing an unsupported --prod flag', () => {
    const tempDir = mkdtempSync(
      join(tmpdir(), 'linejam-bootstrap-convex-deploy-')
    );
    const fakePnpm = join(tempDir, 'pnpm');
    const fakeNode = join(tempDir, 'node');
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
      writeFileSync(
        fakeNode,
        `#!/bin/sh
printf 'node %s\n' "$*" >> "${logPath}"
exit 0
`
      );
      chmodSync(fakeNode, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(process.cwd(), 'scripts/ci/bootstrap-convex-env.mjs'),
          '--deploy',
        ],
        {
          env: {
            ...process.env,
            PATH: `${tempDir}:${process.env.PATH ?? ''}`,
            CONVEX_DEPLOY_KEY: 'prod:team:project|secret',
            GUEST_TOKEN_SECRET: 'guest-secret',
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey(
              'live',
              'clerk.linejam.app'
            ),
            CLERK_JWT_ISSUER_DOMAIN: 'https://clerk.linejam.app',
            ...sentryEnv,
            ...bridgeSecrets,
          },
          encoding: 'utf8',
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const loggedArgs = readFileSync(logPath, 'utf8').trim().split('\n');
      expect(loggedArgs).toEqual([
        'exec convex env --prod set GUEST_TOKEN_SECRET',
        'exec convex env --prod set CLERK_JWT_ISSUER_DOMAIN',
        'exec convex env --prod set LINEJAM_DEPLOY_ENVIRONMENT',
        'exec convex env --prod set LINEJAM_SENTRY_ENABLED',
        'exec convex env --prod set SENTRY_DSN',
        'exec convex env --prod set SENTRY_ENVIRONMENT',
        'exec convex env --prod set SENTRY_RELEASE',
        'exec convex env --prod set SENTRY_WEBHOOK_SECRET',
        'exec convex env --prod set SENTRY_EVENT_WRITE_TOKEN',
        'exec convex env --prod set SENTRY_AUTOMATION_PROVENANCE_SECRET',
        'exec convex env --prod set GITHUB_ISSUES_TOKEN',
        'exec convex env --prod set SENTRY_ORG',
        'exec convex env --prod set SENTRY_EXPECTED_APP_ID',
        'exec convex env --prod set SENTRY_EXPECTED_INSTALLATION_UUID',
        'exec convex env --prod set SENTRY_EXPECTED_PROJECT_ID',
        'exec convex env --prod set SENTRY_GITHUB_INTEGRATION_ID',
        'exec convex env --prod set GITHUB_REPOSITORY_OWNER',
        'exec convex env --prod set GITHUB_REPOSITORY_NAME',
        'exec convex env --prod set SENTRY_AGENT_LOOP_SECRET',
        'exec convex deploy --cmd pnpm run build:check',
        'node scripts/ci/reconcile-convex-env.mjs',
        'node scripts/convex/probe-signed-throttle-ready.mjs --assert-prod-target',
      ]);
      expect(loggedArgs.join('\n')).not.toContain('guest-secret');
      expect(loggedArgs.join('\n')).not.toContain('public@sentry.example');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
