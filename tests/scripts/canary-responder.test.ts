/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEventFingerprint,
  processDelivery,
  reconcilePendingSmoke,
  resolvePayloadService,
  summarizeProcessing,
  verifySignature,
} from '@/scripts/canary/responder.mjs';

function createDependencies(overrides = {}) {
  return {
    deliveryExists: vi.fn().mockResolvedValue(false),
    fingerprintExists: vi.fn().mockResolvedValue(false),
    listPendingSmokeDeliveries: vi.fn().mockResolvedValue([]),
    fetchCanaryContext: vi.fn().mockResolvedValue({ incidents: [] }),
    persistDelivery: vi.fn().mockResolvedValue('/tmp/delivery.json'),
    persistFingerprint: vi.fn().mockResolvedValue('/tmp/fingerprint.json'),
    persistJson: vi.fn().mockResolvedValue('/tmp/context.json'),
    pruneExpiredArtifacts: vi.fn().mockResolvedValue({
      deletedFiles: [],
      cutoffTimestamp: Date.now(),
    }),
    persistSummary: vi.fn().mockResolvedValue('/tmp/summary.md'),
    runSmoke: vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
      code: 0,
    }),
    scheduleSmoke: vi.fn().mockReturnValue(true),
    shouldTriggerSmoke: vi.fn().mockReturnValue(false),
    smokeTriggersEnabled: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

type DefaultDependencyOverrides = {
  store?: {
    deliveryExists?: ReturnType<typeof vi.fn>;
    fingerprintExists?: ReturnType<typeof vi.fn>;
    listPendingSmokeDeliveries?: ReturnType<typeof vi.fn>;
    persistDelivery?: ReturnType<typeof vi.fn>;
    persistFingerprint?: ReturnType<typeof vi.fn>;
    persistJson?: ReturnType<typeof vi.fn>;
    pruneExpiredArtifacts?: ReturnType<typeof vi.fn>;
    persistSummary?: ReturnType<typeof vi.fn>;
  };
  context?: {
    fetchCanaryContext?: ReturnType<typeof vi.fn>;
  };
  trigger?: {
    runSmoke?: ReturnType<typeof vi.fn>;
    shouldTriggerSmoke?: ReturnType<typeof vi.fn>;
  };
};

async function loadResponderWithDefaultDependencyMocks(
  overrides: DefaultDependencyOverrides = {}
) {
  vi.resetModules();

  const store = {
    deliveryExists: vi.fn().mockResolvedValue(false),
    fingerprintExists: vi.fn().mockResolvedValue(false),
    listPendingSmokeDeliveries: vi.fn().mockResolvedValue([]),
    persistDelivery: vi.fn().mockResolvedValue('/tmp/delivery.json'),
    persistFingerprint: vi.fn().mockResolvedValue('/tmp/fingerprint.json'),
    persistJson: vi.fn().mockResolvedValue('/tmp/context.json'),
    pruneExpiredArtifacts: vi.fn().mockResolvedValue({
      deletedFiles: [],
      cutoffTimestamp: Date.now(),
    }),
    persistSummary: vi.fn().mockResolvedValue('/tmp/summary.md'),
    ...(overrides.store || {}),
  };

  const context = {
    fetchCanaryContext: vi.fn().mockResolvedValue({ incidents: [] }),
    ...(overrides.context || {}),
  };

  const trigger = {
    runSmoke: vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
      code: 0,
    }),
    shouldTriggerSmoke: vi.fn().mockReturnValue(true),
    ...(overrides.trigger || {}),
  };

  vi.doMock('@/scripts/canary/store.mjs', () => store);
  vi.doMock('@/scripts/canary/context.mjs', () => context);
  vi.doMock('@/scripts/canary/trigger-smoke.mjs', () => trigger);

  const responder = await import('@/scripts/canary/responder.mjs');
  return { responder, store, context, trigger };
}

afterEach(() => {
  delete process.env.CANARY_SMOKE_MAX_IN_FLIGHT;
  delete process.env.CANARY_SMOKE_TRIGGER_ENABLED;
  delete process.env.LINEJAM_CANARY_SERVICE;
  vi.resetModules();
  vi.doUnmock('@/scripts/canary/store.mjs');
  vi.doUnmock('@/scripts/canary/context.mjs');
  vi.doUnmock('@/scripts/canary/trigger-smoke.mjs');
});

describe('verifySignature', () => {
  it('accepts valid HMAC-SHA256 signatures', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'canary.ping' }));
    const secret = 'secret';
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

    expect(verifySignature(rawBody, signature, secret)).toBe(true);
    expect(verifySignature(rawBody, 'sha256=bad', secret)).toBe(false);
  });

  it('rejects malformed signature headers', () => {
    const rawBody = Buffer.from('{}');

    expect(verifySignature(rawBody, '', 'secret')).toBe(false);
    expect(verifySignature(rawBody, 'sha1=abc', 'secret')).toBe(false);
    expect(verifySignature(rawBody, 'sha256=short', 'secret')).toBe(false);
  });
});

describe('summarizeProcessing', () => {
  it('includes smoke details when provided', () => {
    const summary = summarizeProcessing({
      eventName: 'error.new_class',
      deliveryId: 'evt-1',
      sequence: 9,
      service: 'linejam',
      smokeResult: {
        skipped: false,
        baseUrl: 'https://www.linejam.app',
        code: 1,
      },
      contextStatus: 'ok',
      contextError: undefined,
      deliveryPath: '/tmp/delivery.json',
      contextPath: '/tmp/context.json',
    });

    expect(summary).toContain('# Canary Delivery evt-1');
    expect(summary).toContain('- Event: `error.new_class`');
    expect(summary).toContain('- Stored context: `/tmp/context.json`');
    expect(summary).toContain('- Context status: `ok`');
    expect(summary).toContain('- Smoke triggered: `yes`');
    expect(summary).toContain('- Smoke base URL: `https://www.linejam.app`');
    expect(summary).toContain('- Smoke exit code: `1`');
  });

  it('includes advisory agentic QA artifact paths when smoke attaches them', () => {
    const summary = summarizeProcessing({
      eventName: 'error.new_class',
      deliveryId: 'evt-agentic',
      sequence: 0,
      service: 'linejam',
      smokeResult: {
        skipped: false,
        baseUrl: 'https://preview.linejam.app',
        code: 0,
        agenticQa: {
          ok: true,
          skipped: false,
          manifest: '.qa/runs/run-1/manifest.json',
          criticSummary: '.qa/runs/run-1/critic-summary.md',
        },
      },
      contextStatus: 'ok',
      contextError: undefined,
      deliveryPath: '/tmp/delivery.json',
      contextPath: undefined,
    });

    expect(summary).toContain('- Agentic QA: `passed`');
    expect(summary).toContain(
      '- Agentic QA manifest: `.qa/runs/run-1/manifest.json`'
    );
    expect(summary).toContain(
      '- Agentic QA critic summary: `.qa/runs/run-1/critic-summary.md`'
    );
  });

  it('omits smoke exit code when smoke is skipped', () => {
    const summary = summarizeProcessing({
      eventName: 'error.new_class',
      deliveryId: 'evt-2',
      sequence: 0,
      service: 'linejam',
      smokeResult: { skipped: true, reason: 'smoke queue saturated' },
      contextStatus: 'failed',
      contextError:
        'Canary API /api/v1/report returned 500 Internal Server Error',
      deliveryPath: '/tmp/delivery.json',
      contextPath: undefined,
    });

    expect(summary).toContain('- Smoke triggered: `skipped`');
    expect(summary).toContain('- Smoke reason: `smoke queue saturated`');
    expect(summary).toContain('- Context status: `failed`');
    expect(summary).toContain(
      '- Context error: `Canary API /api/v1/report returned 500 Internal Server Error`'
    );
    expect(summary).not.toContain('Smoke exit code');
  });
});

describe('createEventFingerprint', () => {
  it('stays stable for the same event payload signature', () => {
    expect(
      createEventFingerprint({
        eventName: 'error.new_class',
        rawBodySha256: 'abc',
        sequence: 3,
      })
    ).toBe(
      createEventFingerprint({
        eventName: 'error.new_class',
        rawBodySha256: 'abc',
        sequence: 3,
      })
    );
  });
});

describe('resolvePayloadService', () => {
  it('prefers known nested service fields over the configured default', () => {
    expect(
      resolvePayloadService({
        error: { service: 'linejam' },
      })
    ).toBe('linejam');
    expect(
      resolvePayloadService({
        incident: { service: 'linejam' },
      })
    ).toBe('linejam');
    expect(
      resolvePayloadService({
        incident: { error: { service: 'linejam' } },
      })
    ).toBe('linejam');
    expect(
      resolvePayloadService({
        target: { service: 'linejam' },
      })
    ).toBe('linejam');
  });

  it('returns undefined when the payload does not carry a known service field', () => {
    expect(resolvePayloadService({ event: 'error.new_class' })).toBeUndefined();
  });
});

describe('processDelivery', () => {
  it('returns duplicates without fetching context', async () => {
    const dependencies = createDependencies({
      deliveryExists: vi.fn().mockResolvedValue(true),
    });

    const result = await processDelivery({
      headers: { 'x-event': 'error.new_class', 'x-delivery-id': 'dup-1' },
      rawBody: Buffer.from('{}'),
      payload: {},
      dependencies,
    });

    expect(result.statusCode).toBe(200);
    expect(dependencies.fetchCanaryContext).not.toHaveBeenCalled();
  });

  it('deduplicates retried deliveries by fingerprint even when delivery ids change', async () => {
    const dependencies = createDependencies({
      fingerprintExists: vi.fn().mockResolvedValue(true),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'retry-2',
        'x-sequence': '7',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
      dependencies,
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      status: 'duplicate',
      event: 'error.new_class',
      deliveryId: 'retry-2',
      sequence: 7,
    });
    expect(dependencies.fetchCanaryContext).not.toHaveBeenCalled();
    expect(dependencies.persistDelivery).not.toHaveBeenCalled();
    expect(dependencies.persistFingerprint).not.toHaveBeenCalled();
  });

  it('prefers signed payload metadata over unsigned delivery headers', async () => {
    const dependencies = createDependencies();

    const result = await processDelivery({
      headers: {
        'x-event': 'incident.resolved',
        'x-delivery-id': 'header-delivery',
        'x-sequence': '99',
      },
      rawBody: Buffer.from(
        JSON.stringify({
          event: 'error.new_class',
          delivery_id: 'payload-delivery',
          sequence: 7,
          service: 'linejam',
        })
      ),
      payload: {
        event: 'error.new_class',
        delivery_id: 'payload-delivery',
        sequence: 7,
        service: 'linejam',
      },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body).toMatchObject({
      event: 'error.new_class',
      deliveryId: 'payload-delivery',
      sequence: 7,
    });
    expect(dependencies.persistDelivery).toHaveBeenCalledWith(
      'payload-delivery',
      7,
      expect.objectContaining({
        eventName: 'error.new_class',
        originalDeliveryId: 'payload-delivery',
        sequence: 7,
      })
    );
  });

  it('acknowledges smoke-triggering deliveries without waiting for smoke', async () => {
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(true),
      runSmoke: vi
        .fn()
        .mockImplementation(
          () => new Promise(() => undefined) as Promise<never>
        ),
    });

    await expect(
      Promise.race([
        processDelivery({
          headers: {
            'x-event': 'error.new_class',
            'x-delivery-id': 'evt-1',
            'x-sequence': '7',
          },
          rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
          payload: { service: 'linejam' },
          dependencies,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('processDelivery timed out')), 50);
        }),
      ])
    ).resolves.toMatchObject({
      statusCode: 202,
      body: {
        smokeTriggered: true,
        smokeQueued: true,
      },
    });

    expect(dependencies.persistDelivery).toHaveBeenCalledWith(
      'evt-1',
      7,
      expect.objectContaining({
        smoke: expect.objectContaining({ status: 'pending', queued: true }),
      })
    );
    expect(dependencies.scheduleSmoke).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'evt-1',
        eventName: 'error.new_class',
      })
    );
  });

  it('skips context fetch and smoke for canary ping', async () => {
    const dependencies = createDependencies();

    const result = await processDelivery({
      headers: {
        'x-event': 'canary.ping',
        'x-delivery-id': 'ping-1',
      },
      rawBody: Buffer.from(JSON.stringify({ event: 'canary.ping' })),
      payload: { event: 'canary.ping' },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(dependencies.fetchCanaryContext).not.toHaveBeenCalled();
    expect(dependencies.scheduleSmoke).not.toHaveBeenCalled();
  });

  it('persists delivery even when Canary context fetch fails', async () => {
    const dependencies = createDependencies({
      fetchCanaryContext: vi
        .fn()
        .mockRejectedValue(new Error('canary offline')),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-context-fail',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    if (!('paths' in result.body) || !result.body.paths) {
      throw new Error('expected accepted response');
    }
    expect(result.body.paths.context).toBeUndefined();
    expect(dependencies.persistDelivery).toHaveBeenCalledTimes(2);
    expect(dependencies.persistDelivery).toHaveBeenLastCalledWith(
      'evt-context-fail',
      0,
      expect.objectContaining({
        contextStatus: 'failed',
        contextError: 'canary offline',
      })
    );
  });

  it('falls back invalid sequence values to 0', async () => {
    const dependencies = createDependencies();

    await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-seq',
        'x-sequence': 'not-a-number',
      },
      rawBody: Buffer.from('{}'),
      payload: {},
      dependencies,
    });

    expect(dependencies.persistDelivery).toHaveBeenCalledWith(
      'evt-seq',
      0,
      expect.any(Object)
    );
  });

  it('persists sanitized delivery metadata instead of raw webhook contents', async () => {
    const dependencies = createDependencies();

    await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-sanitized',
        'x-signature': 'sha256=secret',
      },
      rawBody: Buffer.from(
        JSON.stringify({
          service: 'linejam',
          error: {
            service: 'linejam',
            error_class: 'BoomError',
            message: 'do not persist',
          },
        })
      ),
      payload: {
        service: 'linejam',
        error: {
          service: 'linejam',
          error_class: 'BoomError',
          message: 'do not persist',
        },
      },
      dependencies,
    });

    expect(dependencies.persistDelivery).toHaveBeenCalledWith(
      'evt-sanitized',
      0,
      expect.objectContaining({
        headerSummary: expect.objectContaining({
          'x-event': 'error.new_class',
          'x-delivery-id': 'evt-sanitized',
          signaturePresent: true,
        }),
        payloadSummary: expect.objectContaining({
          service: 'linejam',
          error: expect.objectContaining({
            service: 'linejam',
            error_class: 'BoomError',
          }),
        }),
        rawBodySha256: expect.any(String),
        rawBodyBytes: expect.any(Number),
        eventFingerprint: expect.any(String),
      })
    );

    const persistedRecord = dependencies.persistDelivery.mock.calls[0]?.[2];
    expect(persistedRecord.rawBody).toBeUndefined();
    expect(persistedRecord.payload).toBeUndefined();
    expect(persistedRecord.headers).toBeUndefined();
    expect(JSON.stringify(persistedRecord)).not.toContain('do not persist');
    expect(dependencies.persistFingerprint).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        deliveryId: 'evt-sanitized',
        sequence: 0,
      })
    );
  });

  it('marks smoke as skipped when queue is saturated', async () => {
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(true),
      scheduleSmoke: vi.fn().mockReturnValue(false),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-queue',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.smokeTriggered).toBe(true);
    expect(result.body.smokeQueued).toBe(false);
    expect(dependencies.persistDelivery).toHaveBeenLastCalledWith(
      'evt-queue',
      0,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'skipped',
          queued: false,
          reason: 'smoke queue saturated',
        }),
      })
    );
  });

  it('marks smoke as skipped with not_triggered when the event does not request smoke', async () => {
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(false),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.untracked',
        'x-delivery-id': 'evt-not-triggered',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.smokeTriggered).toBe(false);
    expect(result.body.smokeQueued).toBe(false);
    expect(dependencies.persistDelivery).toHaveBeenLastCalledWith(
      'evt-not-triggered',
      0,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'skipped',
          queued: false,
          reason: 'not_triggered',
        }),
      })
    );
  });

  it('generates unique fallback ids when delivery id is missing', async () => {
    const dependencies = createDependencies({
      deliveryExists: vi.fn().mockResolvedValue(true),
    });

    const result = await processDelivery({
      headers: { 'x-event': 'error.new_class' },
      rawBody: Buffer.from('{}'),
      payload: {},
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.deliveryId).toMatch(/^missing-/);
    expect(result.body.deliveryIdMissing).toBe(true);
    expect(dependencies.deliveryExists).not.toHaveBeenCalled();
    expect(dependencies.persistDelivery).toHaveBeenCalledWith(
      expect.stringMatching(/^missing-/),
      0,
      expect.objectContaining({
        deliveryIdMissing: true,
        originalDeliveryId: null,
      })
    );
  });

  it('skips smoke/context for non-configured services', async () => {
    process.env.LINEJAM_CANARY_SERVICE = 'linejam';
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(true),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-other-service',
      },
      rawBody: Buffer.from('{}'),
      payload: { service: 'other-service' },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.serviceMatched).toBe(false);
    expect(result.body.smokeTriggered).toBe(false);
    expect(result.body.smokeQueued).toBe(false);
    expect(dependencies.fetchCanaryContext).not.toHaveBeenCalled();
    expect(dependencies.scheduleSmoke).not.toHaveBeenCalled();
    expect(dependencies.persistDelivery).toHaveBeenLastCalledWith(
      'evt-other-service',
      0,
      expect.objectContaining({
        contextStatus: 'skipped_service_mismatch',
        smoke: expect.objectContaining({
          status: 'skipped',
          reason: 'service_mismatch',
        }),
      })
    );
  });

  it('uses nested service fields to decide whether to trigger context and smoke', async () => {
    process.env.LINEJAM_CANARY_SERVICE = 'linejam';
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(true),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-nested-service',
      },
      rawBody: Buffer.from(
        JSON.stringify({ error: { service: 'linejam', error_class: 'Boom' } })
      ),
      payload: { error: { service: 'linejam', error_class: 'Boom' } },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.service).toBe('linejam');
    expect(result.body.serviceMatched).toBe(true);
    expect(result.body.smokeTriggered).toBe(true);
    expect(dependencies.fetchCanaryContext).toHaveBeenCalledWith('linejam');
    expect(dependencies.scheduleSmoke).toHaveBeenCalled();
  });

  it('skips context and smoke when a non-ping payload omits service', async () => {
    process.env.LINEJAM_CANARY_SERVICE = 'linejam';
    const dependencies = createDependencies({
      shouldTriggerSmoke: vi.fn().mockReturnValue(true),
    });

    const result = await processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-unknown-service',
      },
      rawBody: Buffer.from(JSON.stringify({ error: { error_class: 'Boom' } })),
      payload: { error: { error_class: 'Boom' } },
      dependencies,
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.service).toBe('unknown');
    expect(result.body.serviceMatched).toBe(false);
    expect(result.body.smokeTriggered).toBe(false);
    expect(result.body.smokeQueued).toBe(false);
    expect(dependencies.fetchCanaryContext).not.toHaveBeenCalled();
    expect(dependencies.scheduleSmoke).not.toHaveBeenCalled();
    expect(dependencies.persistDelivery).toHaveBeenLastCalledWith(
      'evt-unknown-service',
      0,
      expect.objectContaining({
        contextStatus: 'skipped_service_unknown',
        smoke: expect.objectContaining({
          status: 'skipped',
          reason: 'service_unknown',
        }),
      })
    );
  });
});

describe('processDelivery default smoke follow-up', () => {
  it('writes terminal smoke success status back onto delivery record', async () => {
    process.env.CANARY_SMOKE_MAX_IN_FLIGHT = '1';
    const { responder, store, trigger } =
      await loadResponderWithDefaultDependencyMocks();

    const result = await responder.processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-terminal-success',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.smokeTriggered).toBe(true);
    expect(result.body.smokeQueued).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(trigger.runSmoke).toHaveBeenCalledWith({
      eventName: 'error.new_class',
      deliveryId: 'evt-terminal-success',
    });
    expect(store.persistDelivery).toHaveBeenLastCalledWith(
      'evt-terminal-success',
      0,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'succeeded',
          queued: false,
          result: expect.objectContaining({ ok: true, code: 0 }),
        }),
      })
    );
  });

  it('writes skipped status when smoke is intentionally skipped', async () => {
    const { responder, store } = await loadResponderWithDefaultDependencyMocks({
      trigger: {
        runSmoke: vi.fn().mockResolvedValue({
          ok: false,
          skipped: true,
          reason: 'PLAYWRIGHT_BASE_URL is not configured',
        }),
      },
    });

    await responder.processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-terminal-skipped',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.persistDelivery).toHaveBeenLastCalledWith(
      'evt-terminal-skipped',
      0,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'skipped',
          queued: false,
          result: expect.objectContaining({
            skipped: true,
            reason: 'PLAYWRIGHT_BASE_URL is not configured',
          }),
        }),
      })
    );
  });

  it('writes terminal smoke failure status when smoke run throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { responder, store } = await loadResponderWithDefaultDependencyMocks({
      trigger: {
        runSmoke: vi.fn().mockRejectedValue(new Error('smoke crashed')),
      },
    });

    await responder.processDelivery({
      headers: {
        'x-event': 'error.new_class',
        'x-delivery-id': 'evt-terminal-failure',
      },
      rawBody: Buffer.from(JSON.stringify({ service: 'linejam' })),
      payload: { service: 'linejam' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.persistDelivery).toHaveBeenLastCalledWith(
      'evt-terminal-failure',
      0,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'failed',
          queued: false,
          result: expect.objectContaining({ reason: 'smoke crashed' }),
        }),
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Canary smoke follow-up failed',
      expect.any(Error)
    );
  });
});

describe('reconcilePendingSmoke', () => {
  it('replays persisted pending smoke deliveries on startup', async () => {
    const runSmokeMock = vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
      code: 0,
    });
    const persistDeliveryMock = vi.fn().mockResolvedValue('/tmp/delivery.json');
    const persistJsonMock = vi.fn().mockResolvedValue('/tmp/smoke.json');
    const persistSummaryMock = vi.fn().mockResolvedValue('/tmp/summary.md');

    const result = await reconcilePendingSmoke({
      listPendingSmokeDeliveries: vi.fn().mockResolvedValue([
        {
          deliveryId: 'evt-replay-1',
          eventName: 'error.new_class',
          service: 'linejam',
          sequence: 0,
          deliveryRecord: {
            deliveryId: 'evt-replay-1',
            eventName: 'error.new_class',
            service: 'linejam',
            sequence: 0,
            smoke: { status: 'pending', queued: true },
          },
        },
        {
          deliveryId: 'evt-replay-2',
          eventName: 'incident.opened',
          service: 'linejam',
          sequence: 3,
          deliveryRecord: {
            deliveryId: 'evt-replay-2',
            eventName: 'incident.opened',
            service: 'linejam',
            sequence: 3,
            smoke: { status: 'pending', queued: true },
          },
        },
      ]),
      persistDelivery: persistDeliveryMock,
      persistJson: persistJsonMock,
      persistSummary: persistSummaryMock,
      runSmoke: runSmokeMock,
    });

    expect(result).toEqual({ replayed: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runSmokeMock).toHaveBeenCalledTimes(2);
    expect(runSmokeMock).toHaveBeenCalledWith({
      deliveryId: 'evt-replay-1',
      eventName: 'error.new_class',
    });
    expect(runSmokeMock).toHaveBeenCalledWith({
      deliveryId: 'evt-replay-2',
      eventName: 'incident.opened',
    });
    expect(persistDeliveryMock).toHaveBeenCalledWith(
      'evt-replay-2',
      3,
      expect.objectContaining({
        smoke: expect.objectContaining({
          status: 'succeeded',
          queued: false,
        }),
      })
    );
  });

  it('returns zero when replay support is unavailable', async () => {
    await expect(reconcilePendingSmoke({})).resolves.toEqual({ replayed: 0 });
  });

  it('applies pending smoke backpressure during startup replay', async () => {
    process.env.CANARY_SMOKE_MAX_IN_FLIGHT = '1';
    process.env.CANARY_SMOKE_MAX_PENDING = '1';

    let releaseFirstSmoke: (() => void) | undefined;
    const runSmokeMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstSmoke = () =>
              resolve({ ok: true, skipped: false, code: 0 });
          })
      )
      .mockResolvedValue({ ok: true, skipped: false, code: 0 });

    const result = await reconcilePendingSmoke({
      listPendingSmokeDeliveries: vi.fn().mockResolvedValue([
        {
          deliveryId: 'evt-replay-1',
          eventName: 'error.new_class',
          service: 'linejam',
          sequence: 0,
          deliveryRecord: { smoke: { status: 'pending', queued: true } },
        },
        {
          deliveryId: 'evt-replay-2',
          eventName: 'incident.opened',
          service: 'linejam',
          sequence: 1,
          deliveryRecord: { smoke: { status: 'pending', queued: true } },
        },
        {
          deliveryId: 'evt-replay-3',
          eventName: 'incident.updated',
          service: 'linejam',
          sequence: 2,
          deliveryRecord: { smoke: { status: 'pending', queued: true } },
        },
      ]),
      persistDelivery: vi.fn().mockResolvedValue('/tmp/delivery.json'),
      persistJson: vi.fn().mockResolvedValue('/tmp/smoke.json'),
      persistSummary: vi.fn().mockResolvedValue('/tmp/summary.md'),
      runSmoke: runSmokeMock,
    });

    expect(result).toEqual({ replayed: 2 });
    releaseFirstSmoke?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runSmokeMock).toHaveBeenCalledTimes(2);
  });
});
