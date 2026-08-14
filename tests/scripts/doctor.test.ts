/** @vitest-environment node */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  checkAppHealth,
  checkCanaryConfig,
  checkCanaryReachable,
  checkClerkConfig,
  checkConvexConfig,
  checkRequiredEnv,
  loadEnvironment,
  readDotEnv,
  runDoctor,
} from '@/scripts/doctor.mjs';

function clerkKeyFor(host: string): string {
  return 'pk_test_' + Buffer.from(host + '$').toString('base64url');
}

const GOOD_ENV = {
  GUEST_TOKEN_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_CONVEX_URL: 'https://exuberant-bloodhound-885.convex.cloud',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKeyFor(
    'great-moose-1.clerk.accounts.dev'
  ),
  CLERK_SECRET_KEY: 'sk_test_something',
  NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary.example.test',
  NEXT_PUBLIC_CANARY_API_KEY: 'real-key',
};

describe('checkRequiredEnv', () => {
  it('passes with the onboarding env contract', () => {
    expect(checkRequiredEnv(GOOD_ENV)).toEqual({
      status: 'pass',
      message: 'all required values present',
    });
  });

  it('fails loudly and names missing values without exposing secrets', () => {
    const result = checkRequiredEnv({});
    expect(result.status).toBe('fail');
    expect(result.message).toContain('GUEST_TOKEN_SECRET');
    expect(result.message).toContain('CLERK_SECRET_KEY');
    expect(result.message).not.toContain('x'.repeat(32));
  });
});

describe('checkConvexConfig', () => {
  it('accepts a remote deployment URL', () => {
    expect(checkConvexConfig(GOOD_ENV).status).toBe('pass');
  });

  it('accepts the local Convex dev URL', () => {
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'http://localhost:8187' })
        .status
    ).toBe('pass');
  });

  it('rejects malformed or unrelated URLs', () => {
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'not a url' }).status
    ).toBe('fail');
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'https://example.test' })
        .status
    ).toBe('fail');
  });
});

describe('checkClerkConfig', () => {
  it('validates the publishable key and reports only its derived origin', () => {
    const result = checkClerkConfig(GOOD_ENV);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('great-moose-1.clerk.accounts.dev');
    expect(result.message).not.toContain('sk_test_something');
  });

  it('rejects missing or malformed authentication keys', () => {
    expect(checkClerkConfig({}).status).toBe('fail');
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'not-a-key',
        CLERK_SECRET_KEY: 'sk_test_something',
      }).status
    ).toBe('fail');
  });
});

describe('checkCanaryConfig', () => {
  it('rejects the public placeholder key', () => {
    expect(
      checkCanaryConfig({
        NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary.example.test',
        NEXT_PUBLIC_CANARY_API_KEY: 'example_canary_write_key',
      }).status
    ).toBe('fail');
  });

  it('requires a valid endpoint and non-placeholder key', () => {
    expect(checkCanaryConfig(GOOD_ENV).status).toBe('pass');
    expect(
      checkCanaryConfig({ NEXT_PUBLIC_CANARY_API_KEY: 'real-key' }).status
    ).toBe('fail');
  });
});

describe('network probes', () => {
  it('warns when Canary is unreachable', async () => {
    const result = await checkCanaryReachable({
      url: 'https://canary.example.test',
      fetchImpl: vi.fn().mockRejectedValue(new Error('fetch failed')),
    });
    expect(result.status).toBe('warn');
  });

  it('fails when the running app health route is unhealthy', async () => {
    const result = await checkAppHealth({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ status: 'unhealthy' }),
      }),
    });
    expect(result.status).toBe('fail');
  });

  it('uses the local dev health path and passes healthy responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    const result = await checkAppHealth({ fetchImpl });
    expect(result.status).toBe('pass');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/health',
      expect.any(Object)
    );
  });
});

describe('environment loading', () => {
  it('parses dotenv assignments, exports, quotes, and ignores malformed lines', () => {
    const directory = mkdtempSync('/tmp/linejam-doctor-');
    const filePath = path.join(directory, '.env.local');
    writeFileSync(
      filePath,
      `# comment
export FOO = "quoted value"
BAR=plain
INVALID
SINGLE='single value'
`
    );

    expect(readDotEnv(filePath)).toEqual({
      FOO: 'quoted value',
      BAR: 'plain',
      SINGLE: 'single value',
    });
    expect(
      loadEnvironment({
        env: { FOO: 'override', EXTRA: 'yes' },
        envFile: filePath,
      })
    ).toMatchObject({
      FOO: 'override',
      BAR: 'plain',
      EXTRA: 'yes',
    });
    expect(readDotEnv(path.join(directory, 'missing'))).toEqual({});
    rmSync(directory, { recursive: true, force: true });
  });

  it('uses process environment when no options are provided', () => {
    expect(loadEnvironment()).toEqual(expect.any(Object));
    expect(readDotEnv()).toEqual(expect.any(Object));
  });
});

describe('additional doctor failure paths', () => {
  it('rejects unsupported Convex protocols and malformed Clerk secrets', () => {
    expect(
      checkConvexConfig({ NEXT_PUBLIC_CONVEX_URL: 'ftp://localhost' }).status
    ).toBe('fail');
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          GOOD_ENV.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: 'not-a-secret',
      })
    ).toEqual({
      status: 'fail',
      message: 'CLERK_SECRET_KEY has an invalid format',
    });
  });

  it('rejects Clerk keys with empty, insecure, or hostless origins', () => {
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_',
        CLERK_SECRET_KEY: 'sk_test_something',
      }).status
    ).toBe('fail');
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKeyFor(
          'http://great-moose.example'
        ),
        CLERK_SECRET_KEY: 'sk_test_something',
      }).status
    ).toBe('fail');
    expect(
      checkClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKeyFor('localhost'),
        CLERK_SECRET_KEY: 'sk_test_something',
      }).status
    ).toBe('fail');
  });

  it('requires a Canary key after validating its endpoint', () => {
    expect(
      checkCanaryConfig({
        NEXT_PUBLIC_CANARY_ENDPOINT: 'https://canary.example.test',
      })
    ).toEqual({
      status: 'fail',
      name: 'Canary',
      message: 'NEXT_PUBLIC_CANARY_API_KEY is not set',
    });
    expect(
      checkCanaryConfig({
        NEXT_PUBLIC_CANARY_ENDPOINT: 'not-a-url',
        NEXT_PUBLIC_CANARY_API_KEY: 'real-key',
      }).status
    ).toBe('fail');
  });
});

describe('network probe edge cases', () => {
  it('skips an unconfigured Canary and warns on HTTP failures', async () => {
    expect(await checkCanaryReachable()).toEqual({
      name: 'Canary reachability',
      status: 'skip',
      message: 'no endpoint configured',
    });
    expect(
      (
        await checkCanaryReachable({
          url: 'https://canary.example.test',
          fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
        })
      ).status
    ).toBe('warn');
  });

  it('warns on an unavailable app and fails on invalid health JSON', async () => {
    expect(
      (
        await checkAppHealth({
          fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
        })
      ).status
    ).toBe('warn');
    expect(
      (
        await checkAppHealth({
          fetchImpl: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => {
              throw new Error('bad json');
            },
          }),
        })
      ).status
    ).toBe('fail');
    expect(
      (
        await checkAppHealth({
          url: 'http://localhost:3000/custom-health',
          fetchImpl: vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({}) }),
        })
      ).message
    ).toContain('missing');
  });
});

describe('runDoctor configuration branches', () => {
  it('does not probe Canary when its configuration fails and honors a custom health URL', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('app offline'));
    const results = await runDoctor({
      env: {
        ...GOOD_ENV,
        NEXT_PUBLIC_CANARY_API_KEY: '',
        LINEJAM_DOCTOR_HEALTH_URL: 'http://127.0.0.1:9999/health',
      },
      fetchImpl,
    });
    expect(results.map((result) => result.name)).toEqual([
      'required env',
      'Convex',
      'Clerk',
      'Canary',
      'app health',
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:9999/health',
      expect.any(Object)
    );
  });
});

describe('runDoctor', () => {
  it('runs config and live probes without leaking values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    const results = await runDoctor({ env: GOOD_ENV, fetchImpl });
    expect(results.map((result) => result.name)).toEqual([
      'required env',
      'Convex',
      'Clerk',
      'Canary',
      'Canary reachability',
      'app health',
    ]);
    expect(results.every((result) => result.status === 'pass')).toBe(true);
  });
});
