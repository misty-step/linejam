/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  planCheckIn,
  resolveCanaryConfig,
  run,
  sendAnnotation,
  sendCheckIn,
} from '@/scripts/ops/report-prod-smoke-status.mjs';

describe('planCheckIn', () => {
  it('reports ok on success', () => {
    expect(planCheckIn({ outcome: 'success', consecutiveFailures: 0 })).toEqual(
      { status: 'ok', summary: 'Production Smoke passed.' }
    );
  });

  it('does not escalate a single failure below the threshold', () => {
    const plan = planCheckIn({ outcome: 'failure', consecutiveFailures: 1 });
    // 'alive' maps to Canary's Up health state -- annotation, not incident.
    expect(plan.status).toBe('alive');
    expect(plan.summary).toContain('consecutive failures: 1');
  });

  it('escalates to error at the 2-run threshold, tripping Canary Down', () => {
    const plan = planCheckIn({ outcome: 'failure', consecutiveFailures: 2 });
    expect(plan.status).toBe('error');
    expect(plan.summary).toContain('2 consecutive runs');
  });

  it('stays escalated for longer streaks', () => {
    const plan = planCheckIn({ outcome: 'failure', consecutiveFailures: 5 });
    expect(plan.status).toBe('error');
  });
});

describe('resolveCanaryConfig', () => {
  it('prefers server-only CANARY_API_KEY over the public key', () => {
    expect(
      resolveCanaryConfig({
        CANARY_API_KEY: 'server-key',
        NEXT_PUBLIC_CANARY_API_KEY: 'public-key',
      })
    ).toEqual({
      apiKey: 'server-key',
      endpoint: 'https://canary.mistystep.io',
    });
  });

  it('falls back to the public ingest key CI already provisions', () => {
    expect(
      resolveCanaryConfig({ NEXT_PUBLIC_CANARY_API_KEY: 'public-key' })
    ).toEqual({
      apiKey: 'public-key',
      endpoint: 'https://canary.mistystep.io',
    });
  });

  it('returns an empty key rather than throwing when unconfigured', () => {
    expect(resolveCanaryConfig({})).toEqual({
      apiKey: '',
      endpoint: 'https://canary.mistystep.io',
    });
  });
});

describe('sendCheckIn', () => {
  it('skips the network call when no ingest key is configured', async () => {
    const fetchImpl = vi.fn();
    const result = await sendCheckIn({
      status: 'ok',
      summary: 'x',
      env: {},
      fetchImpl,
    });

    expect(result).toEqual({
      skipped: true,
      reason: 'Canary ingest key is not configured',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs the monitor check-in with the resolved config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ check_in_id: 'CHK-1', state: 'up' }),
    });

    const result = await sendCheckIn({
      status: 'error',
      summary: 'Production Smoke failed 2 consecutive runs.',
      context: { consecutiveFailures: 2 },
      env: {
        NEXT_PUBLIC_CANARY_API_KEY: 'test-key',
        CANARY_RESPONDER_API_KEY: 'responder-key',
      },
      fetchImpl,
    });

    expect(result).toEqual({
      skipped: false,
      status: 201,
      body: { check_in_id: 'CHK-1', state: 'up' },
    });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://canary.mistystep.io/api/v1/check-ins');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      monitor: 'linejam-production-smoke',
      status: 'error',
      summary: 'Production Smoke failed 2 consecutive runs.',
      context: { consecutiveFailures: 2 },
    });
  });

  it('throws with the response body when Canary rejects the check-in', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'unknown monitor',
    });

    await expect(
      sendCheckIn({
        status: 'ok',
        summary: 'x',
        env: { NEXT_PUBLIC_CANARY_API_KEY: 'test-key' },
        fetchImpl,
      })
    ).rejects.toThrow('HTTP 422');
  });
});

describe('sendAnnotation', () => {
  it('requires the responder key when production strict mode is set', async () => {
    await expect(
      sendAnnotation({
        action: 'triaged',
        metadata: {},
        env: { LINEJAM_SMOKE_REQUIRE_ALERT_ANNOTATION: '1' },
      })
    ).rejects.toThrow('CANARY_RESPONDER_API_KEY is required');
  });

  it('writes monitor-scoped failure detail with the responder key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'ANN-1' }),
    });
    await sendAnnotation({
      action: 'triaged',
      metadata: { failure_detail: 'prod-smoke.spec.ts' },
      env: { CANARY_RESPONDER_API_KEY: 'responder-key' },
      fetchImpl,
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://canary.mistystep.io/api/v1/annotations');
    expect(JSON.parse(options.body)).toEqual({
      subject_type: 'monitor',
      subject_id: 'MON-28junwbo5mgv',
      agent: 'github/linejam-production-smoke',
      action: 'triaged',
      metadata: { failure_detail: 'prod-smoke.spec.ts' },
    });
  });
});

describe('run', () => {
  it('rejects an outcome that is not success or failure', async () => {
    await expect(
      run({ outcome: 'cancelled', env: { NEXT_PUBLIC_CANARY_API_KEY: 'k' } })
    ).rejects.toThrow('LINEJAM_SMOKE_OUTCOME must be "success" or "failure"');
  });

  it('threads consecutiveFailures and runUrl into the check-in context', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '{}',
    });

    await run({
      outcome: 'failure',
      consecutiveFailures: 2,
      runUrl: 'https://github.com/misty-step/linejam/actions/runs/123',
      env: {
        NEXT_PUBLIC_CANARY_API_KEY: 'test-key',
        CANARY_RESPONDER_API_KEY: 'responder-key',
      },
      fetchImpl,
    });

    const [, options] = fetchImpl.mock.calls[1];
    const body = JSON.parse(options.body);
    expect(body.status).toBe('error');
    expect(body.context).toEqual({
      consecutiveFailures: 2,
      runUrl: 'https://github.com/misty-step/linejam/actions/runs/123',
    });
  });

  it('includes the failing detail on failure but never on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '{}',
    });

    await run({
      outcome: 'failure',
      consecutiveFailures: 2,
      failureDetail: '  guest-flow.spec.ts: expect(locator).toBeVisible()  ',
      env: {
        NEXT_PUBLIC_CANARY_API_KEY: 'test-key',
        CANARY_RESPONDER_API_KEY: 'responder-key',
      },
      fetchImpl,
    });
    const failureBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(failureBody.context.failureDetail).toBe(
      'guest-flow.spec.ts: expect(locator).toBeVisible()'
    );

    fetchImpl.mockClear();
    await run({
      outcome: 'success',
      failureDetail: 'should never appear',
      env: {
        NEXT_PUBLIC_CANARY_API_KEY: 'test-key',
        CANARY_RESPONDER_API_KEY: 'responder-key',
      },
      fetchImpl,
    });
    const successBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(successBody.context.failureDetail).toBeUndefined();
  });
});
