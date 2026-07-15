/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import {
  diffConvexEnvNames,
  parseConvexEnvNames,
  resolveReconciliationTarget,
  runConvexEnvReconciliation,
  validateConvexEnvManifest,
} from '@/scripts/ci/reconcile-convex-env.mjs';

const manifest = {
  schemaVersion: 1 as const,
  environments: {
    development: {
      required: ['CLERK_JWT_ISSUER_DOMAIN', 'GUEST_TOKEN_SECRET'],
      optional: ['OPENROUTER_API_KEY'],
    },
    preview: {
      required: ['GUEST_TOKEN_SECRET', 'OPENROUTER_API_KEY'],
      optional: [],
    },
    production: {
      required: [
        'CANARY_API_KEY',
        'CANARY_ENDPOINT',
        'CLERK_JWT_ISSUER_DOMAIN',
        'GUEST_TOKEN_SECRET',
        'OPENROUTER_API_KEY',
      ],
      optional: ['AI_MODEL'],
    },
  },
};

describe('Convex environment reconciliation', () => {
  it('supports explicit values-free operator targets without a deploy key', () => {
    const emptyEnv = {} as NodeJS.ProcessEnv;
    expect(
      resolveReconciliationTarget(['--target', 'development'], emptyEnv)
    ).toEqual({ status: 'default', args: [], explicit: true });
    expect(
      resolveReconciliationTarget(['--target', 'production'], emptyEnv)
    ).toEqual({ status: 'prod', args: ['--prod'], explicit: true });
  });

  it('removes an ambient deploy key from explicit operator targets', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: 'CLERK_JWT_ISSUER_DOMAIN\nGUEST_TOKEN_SECRET\n',
      stderr: '',
    });

    runConvexEnvReconciliation({
      target: { status: 'default', args: [], explicit: true },
      manifest,
      runner,
      logger: { log: vi.fn() },
      env: { ...process.env, CONVEX_DEPLOY_KEY: 'prod:must-not-leak' },
    });

    expect(runner).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'convex', 'env', 'list', '--names-only'],
      expect.objectContaining({
        env: expect.not.objectContaining({
          CONVEX_DEPLOY_KEY: expect.anything(),
        }),
      })
    );
  });

  it('validates a values-free, environment-specific manifest', () => {
    expect(validateConvexEnvManifest(manifest)).toEqual(manifest);
    expect(() =>
      validateConvexEnvManifest({
        ...manifest,
        environments: {
          ...manifest.environments,
          production: {
            required: ['GUEST_TOKEN_SECRET=secret-value'],
            optional: [],
          },
        },
      })
    ).toThrow('environment variable names');
    expect(() =>
      validateConvexEnvManifest({
        ...manifest,
        secretValues: { GUEST_TOKEN_SECRET: 'do-not-store-this' },
      })
    ).toThrow('unsupported fields');
  });

  it('parses only names and refuses value-bearing CLI output without echoing it', () => {
    expect(
      parseConvexEnvNames('GUEST_TOKEN_SECRET\nOPENROUTER_API_KEY\n')
    ).toEqual(['GUEST_TOKEN_SECRET', 'OPENROUTER_API_KEY']);

    const secretOutput = 'GUEST_TOKEN_SECRET=do-not-disclose';
    let error: unknown;
    try {
      parseConvexEnvNames(secretOutput);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('names-only');
    expect(String(error)).not.toContain('do-not-disclose');
  });

  it('reports missing and unexpected names deterministically', () => {
    expect(
      diffConvexEnvNames(manifest.environments.production, [
        'OPENROUTER_API_KEY',
        'GUEST_TOKEN_SECRET',
        'UNDECLARED_KEY',
        'CANARY_ENDPOINT',
        'CANARY_API_KEY',
      ])
    ).toEqual({
      missing: ['CLERK_JWT_ISSUER_DOMAIN'],
      unexpected: ['UNDECLARED_KEY'],
    });
  });

  it('targets production with names-only output and emits a names-only receipt', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: [
        'CANARY_API_KEY',
        'CANARY_ENDPOINT',
        'CLERK_JWT_ISSUER_DOMAIN',
        'GUEST_TOKEN_SECRET',
        'OPENROUTER_API_KEY',
      ].join('\n'),
      stderr: 'provider warning that must not be echoed',
    });
    const logger = { log: vi.fn() };

    expect(
      runConvexEnvReconciliation({
        target: { status: 'prod', args: ['--prod'] },
        manifest,
        runner,
        logger,
      })
    ).toMatchObject({
      environment: 'production',
      missing: [],
      unexpected: [],
    });
    expect(runner).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'convex', 'env', '--prod', 'list', '--names-only'],
      expect.objectContaining({ encoding: 'utf8', timeout: 30_000 })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'CANARY_API_KEY,CANARY_ENDPOINT,CLERK_JWT_ISSUER_DOMAIN,GUEST_TOKEN_SECRET,OPENROUTER_API_KEY'
      )
    );
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining('provider warning')
    );
  });

  it('fails closed naming only the missing variable', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: [
        'CANARY_API_KEY',
        'CANARY_ENDPOINT',
        'CLERK_JWT_ISSUER_DOMAIN',
        'GUEST_TOKEN_SECRET',
      ].join('\n'),
      stderr: 'do-not-disclose-provider-output',
    });

    expect(() =>
      runConvexEnvReconciliation({
        target: { status: 'prod', args: ['--prod'] },
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow(
      'Convex production environment drift: missing=OPENROUTER_API_KEY; unexpected=none'
    );
  });

  it('fails without replaying CLI output when the names-only command fails', () => {
    const runner = vi.fn().mockReturnValue({
      status: 1,
      stdout: 'GUEST_TOKEN_SECRET=do-not-disclose',
      stderr: 'CONVEX_DEPLOY_KEY=do-not-disclose',
    });

    expect(() =>
      runConvexEnvReconciliation({
        target: { status: 'prod', args: ['--prod'] },
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow('Convex production names-only read failed with status 1');
  });

  it('fails closed when the names-only CLI times out', () => {
    const timeout = Object.assign(new Error('do-not-replay'), {
      code: 'ETIMEDOUT',
    });

    expect(() =>
      runConvexEnvReconciliation({
        target: { status: 'prod', args: ['--prod'] },
        manifest,
        runner: vi.fn().mockReturnValue({ status: null, error: timeout }),
        logger: { log: vi.fn() },
      })
    ).toThrow('Convex production names-only read timed out');
  });
});
