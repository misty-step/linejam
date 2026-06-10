/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type ServerAddress = {
  port: number;
};

function signPayload(secret: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('canary responder http server', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.LINEJAM_CANARY_WEBHOOK_SECRET;
    delete process.env.LINEJAM_CANARY_WEBHOOK_PATH;
    delete process.env.LINEJAM_CANARY_RESPONDER_PORT;
    delete process.env.PORT;
    delete process.env.LINEJAM_CANARY_STORE_DIR;
    delete process.env.CANARY_API_KEY;
    delete process.env.CANARY_SMOKE_TRIGGER_ENABLED;
    delete process.env.CANARY_SMOKE_MAX_IN_FLIGHT;
    delete process.env.CANARY_SMOKE_MAX_PENDING;
    delete process.env.LINEJAM_CANARY_MAX_BODY_BYTES;
    vi.resetModules();
    vi.unmock('@/scripts/canary/context.mjs');
    vi.unmock('@/scripts/canary/trigger-smoke.mjs');
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  async function readStoredDelivery(dir: string) {
    const deliveryDir = path.join(dir, 'deliveries');
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const [deliveryFile] = await readdir(deliveryDir);
        const contents = await readFile(
          path.join(deliveryDir, deliveryFile),
          'utf8'
        );
        return JSON.parse(contents);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    throw lastError || new Error('delivery file was never readable');
  }

  async function waitForStoredFiles(
    dir: string,
    subdirectory: string,
    count: number
  ) {
    const targetDir = path.join(dir, subdirectory);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const entries = await readdir(targetDir);
        if (entries.length >= count) {
          return entries;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw lastError || new Error(`${subdirectory} files were never persisted`);
  }

  async function waitForMockCalls(
    mock: ReturnType<typeof vi.fn>,
    count: number
  ) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (mock.mock.calls.length >= count) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(mock).toHaveBeenCalledTimes(count);
  }

  async function startResponder(options?: {
    withSecret?: boolean;
    smokeEnabled?: boolean;
    responderPort?: string | null;
    dependencyMocks?: {
      fetchCanaryContext?: ReturnType<typeof vi.fn>;
      runSmoke?: ReturnType<typeof vi.fn>;
      shouldTriggerSmoke?: ReturnType<typeof vi.fn>;
    };
  }) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-http-'));
    tempDirs.push(dir);
    if (options?.withSecret !== false) {
      process.env.LINEJAM_CANARY_WEBHOOK_SECRET = 'secret';
    } else {
      delete process.env.LINEJAM_CANARY_WEBHOOK_SECRET;
    }
    process.env.LINEJAM_CANARY_WEBHOOK_PATH = '/canary/webhook';
    if (options?.responderPort === null) {
      delete process.env.LINEJAM_CANARY_RESPONDER_PORT;
    } else {
      process.env.LINEJAM_CANARY_RESPONDER_PORT = options?.responderPort ?? '0';
    }
    process.env.LINEJAM_CANARY_STORE_DIR = dir;
    process.env.CANARY_API_KEY = 'canary-secret';
    process.env.CANARY_SMOKE_TRIGGER_ENABLED =
      options?.smokeEnabled === false ? '0' : '1';

    const fetchCanaryContext =
      options?.dependencyMocks?.fetchCanaryContext ||
      vi.fn().mockResolvedValue({ incidents: [] });
    const runSmoke =
      options?.dependencyMocks?.runSmoke ||
      vi.fn().mockResolvedValue({ ok: true, skipped: false, code: 0 });
    const shouldTriggerSmoke =
      options?.dependencyMocks?.shouldTriggerSmoke ||
      vi.fn().mockReturnValue(false);

    vi.doMock('@/scripts/canary/context.mjs', () => ({
      fetchCanaryContext,
    }));
    vi.doMock('@/scripts/canary/trigger-smoke.mjs', () => ({
      runSmoke,
      shouldTriggerSmoke,
    }));

    const { startServer } = await import('@/scripts/canary/responder.mjs');
    const server = startServer();
    await new Promise<void>((resolve) => server.once('listening', resolve));

    const address = server.address() as ServerAddress;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return {
      server,
      baseUrl,
      dir,
      mocks: { fetchCanaryContext, runSmoke, shouldTriggerSmoke },
    };
  }

  it('serves health checks', async () => {
    const { server, baseUrl } = await startResponder();

    try {
      const response = await fetch(`${baseUrl}/healthz`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: 'ok',
        ready: true,
        readiness: { status: 'ok' },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('uses PORT when LINEJAM_CANARY_RESPONDER_PORT is unset', async () => {
    process.env.PORT = '0';
    const { server, baseUrl } = await startResponder({ responderPort: null });

    try {
      const response = await fetch(`${baseUrl}/healthz`);
      expect(response.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('keeps liveness green even when the webhook secret is missing', async () => {
    const { server, baseUrl } = await startResponder({ withSecret: false });

    try {
      const response = await fetch(`${baseUrl}/healthz`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: 'ok',
        ready: false,
        readiness: {
          status: 'error',
          error: 'LINEJAM_CANARY_WEBHOOK_SECRET is required',
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports 503 on readiness checks when the webhook secret is missing', async () => {
    const { server, baseUrl } = await startResponder({ withSecret: false });

    try {
      const response = await fetch(`${baseUrl}/readyz`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: 'error',
        error: 'LINEJAM_CANARY_WEBHOOK_SECRET is required',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports 503 on readiness checks when the Canary API key is missing', async () => {
    const { server, baseUrl } = await startResponder();
    delete process.env.CANARY_API_KEY;

    try {
      const response = await fetch(`${baseUrl}/readyz`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: 'error',
        error: 'CANARY_API_KEY is required',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('accepts signed webhook requests even with query string path', async () => {
    const { server, baseUrl } = await startResponder({ smokeEnabled: false });
    const body = JSON.stringify({
      event: 'canary.ping',
      delivery_id: 'evt-http',
      sequence: 1,
    });

    try {
      const response = await fetch(`${baseUrl}/canary/webhook?source=test`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        status: 'accepted',
        event: 'canary.ping',
        smokeTriggered: false,
        smokeQueued: false,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects missing or invalid signatures', async () => {
    const { server, baseUrl } = await startResponder({ smokeEnabled: false });
    const body = JSON.stringify({ event: 'canary.ping' });

    try {
      const missing = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(missing.status).toBe(400);

      const invalid = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': 'sha256=invalid',
        },
        body,
      });
      expect(invalid.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns 404 for unmatched routes', async () => {
    const { server, baseUrl } = await startResponder({ smokeEnabled: false });

    try {
      const response = await fetch(`${baseUrl}/not-found`);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'not_found' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('queues smoke follow-up during short bursts before declaring saturation', async () => {
    process.env.CANARY_SMOKE_MAX_IN_FLIGHT = '1';
    process.env.CANARY_SMOKE_MAX_PENDING = '1';

    let releaseFirstSmoke: (() => void) | undefined;
    const runSmoke = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstSmoke = () =>
              resolve({ ok: true, skipped: false, code: 0 });
          })
      )
      .mockResolvedValue({ ok: true, skipped: false, code: 0 });

    const { server, baseUrl, dir, mocks } = await startResponder({
      dependencyMocks: {
        runSmoke,
        shouldTriggerSmoke: vi.fn().mockReturnValue(true),
      },
    });

    const bodyOne = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-queue-1',
      error: { service: 'linejam', error_class: 'Boom' },
    });
    const bodyTwo = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-queue-2',
      error: { service: 'linejam', error_class: 'BoomAgain' },
    });
    const bodyThree = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-queue-3',
      error: { service: 'linejam', error_class: 'BoomThird' },
    });

    try {
      const first = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', bodyOne),
        },
        body: bodyOne,
      });
      const second = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', bodyTwo),
        },
        body: bodyTwo,
      });
      const third = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', bodyThree),
        },
        body: bodyThree,
      });

      await expect(first.json()).resolves.toMatchObject({
        smokeTriggered: true,
        smokeQueued: true,
      });
      await expect(second.json()).resolves.toMatchObject({
        smokeTriggered: true,
        smokeQueued: true,
      });
      await expect(third.json()).resolves.toMatchObject({
        smokeTriggered: true,
        smokeQueued: false,
      });

      expect(mocks.runSmoke).toHaveBeenCalledTimes(1);

      releaseFirstSmoke?.();

      await waitForMockCalls(mocks.runSmoke, 2);
      expect(mocks.runSmoke).toHaveBeenCalledTimes(2);
      await waitForStoredFiles(dir, 'smoke', 2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects invalid JSON bodies even with a valid signature', async () => {
    const { server, baseUrl } = await startResponder({ smokeEnabled: false });
    const body = '{invalid-json';

    try {
      const response = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'invalid_json' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects oversized payloads before processing', async () => {
    process.env.LINEJAM_CANARY_MAX_BODY_BYTES = '32';
    const { server, baseUrl } = await startResponder({ smokeEnabled: false });
    const body = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-too-large',
      error: {
        service: 'linejam',
        error_class: 'Boom',
        message: 'payload is intentionally too large',
      },
    });

    try {
      const response = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: 'payload_too_large',
        message: 'request body exceeded 32 bytes',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns processing_failed when webhook secret is missing', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { server, baseUrl } = await startResponder({
      withSecret: false,
      smokeEnabled: false,
    });
    const body = JSON.stringify({ event: 'canary.ping' });

    try {
      const response = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        error: 'processing_failed',
        message: 'LINEJAM_CANARY_WEBHOOK_SECRET is required',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Canary responder failed',
        expect.any(Error)
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('schedules smoke for nested-service error events through the HTTP path', async () => {
    const { server, baseUrl, dir, mocks } = await startResponder({
      smokeEnabled: true,
      dependencyMocks: {
        shouldTriggerSmoke: vi.fn().mockReturnValue(true),
      },
    });
    const body = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-http-smoke',
      error: {
        service: 'linejam',
        error_class: 'Boom',
      },
    });

    try {
      const response = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        status: 'accepted',
        event: 'error.new_class',
        service: 'linejam',
        serviceMatched: true,
        smokeTriggered: true,
        smokeQueued: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mocks.fetchCanaryContext).toHaveBeenCalledWith('linejam');
      expect(mocks.runSmoke).toHaveBeenCalledWith({
        eventName: 'error.new_class',
        deliveryId: 'evt-http-smoke',
      });

      await expect(readStoredDelivery(dir)).resolves.toMatchObject({
        service: 'linejam',
        serviceMatched: true,
        smoke: {
          status: 'succeeded',
          queued: false,
          result: expect.objectContaining({
            ok: true,
            skipped: false,
            code: 0,
          }),
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('stores sanitized delivery artifacts instead of raw webhook bodies', async () => {
    const { server, baseUrl, dir } = await startResponder({
      smokeEnabled: false,
    });
    const body = JSON.stringify({
      event: 'error.new_class',
      delivery_id: 'evt-sanitized',
      sequence: 4,
      error: {
        service: 'linejam',
        error_class: 'BoomError',
        message: 'private payload should not persist',
      },
    });

    try {
      const response = await fetch(`${baseUrl}/canary/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signPayload('secret', body),
        },
        body,
      });

      expect(response.status).toBe(202);

      const stored = await readStoredDelivery(dir);
      expect(stored.rawBody).toBeUndefined();
      expect(stored.payload).toBeUndefined();
      expect(stored.headers).toBeUndefined();
      expect(stored.rawBodySha256).toEqual(expect.any(String));
      expect(stored.rawBodyBytes).toBe(body.length);
      expect(stored.payloadSummary).toMatchObject({
        event: 'error.new_class',
        service: 'linejam',
        error: {
          service: 'linejam',
          error_class: 'BoomError',
        },
      });
      expect(JSON.stringify(stored)).not.toContain(
        'private payload should not persist'
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
