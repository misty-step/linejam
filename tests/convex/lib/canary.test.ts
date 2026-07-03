/** @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function canaryModule() {
  return import('../../../convex/lib/canary');
}

describe('Backend Canary reporter (convex/lib/canary)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CANARY_API_KEY;
    delete process.env.CANARY_ENDPOINT;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('isBackendCanaryEnabled', () => {
    it('returns false when CANARY_API_KEY is not set', async () => {
      delete process.env.CANARY_API_KEY;
      const mod = await canaryModule();
      expect(mod.isBackendCanaryEnabled()).toBe(false);
    });

    it('returns false when CANARY_API_KEY is empty', async () => {
      process.env.CANARY_API_KEY = '';
      const mod = await canaryModule();
      expect(mod.isBackendCanaryEnabled()).toBe(false);
    });

    it('returns true when CANARY_API_KEY is set', async () => {
      process.env.CANARY_API_KEY = 'sk-test-canary-key';
      const mod = await canaryModule();
      expect(mod.isBackendCanaryEnabled()).toBe(true);
    });
  });

  describe('buildBackendCanaryPayload', () => {
    it('normalizes Error objects', async () => {
      const mod = await canaryModule();
      const error = new Error('Test backend failure');
      const payload = mod.buildBackendCanaryPayload(error);

      expect(payload.errorClass).toBe('Error');
      expect(payload.message).toBe('Test backend failure');
      expect(payload.severity).toBe('error');
      expect(payload.stackTrace).toBeDefined();
      expect(payload.context).toBeUndefined();
    });

    it('normalizes string errors', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload('Plain string error');

      expect(payload.errorClass).toBe('StringError');
      expect(payload.message).toBe('Plain string error');
      expect(payload.severity).toBe('error');
    });

    it('normalizes unknown errors', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload({ weird: 'shape' });

      expect(payload.errorClass).toBe('UnknownError');
      expect(payload.message).toContain('[object Object]');
      expect(payload.severity).toBe('error');
    });

    it('scrubs unsafe context keys', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload(new Error('test'), {
        roomCode: 'ABCD',
        guestToken: 'secret-token',
        displayName: 'Alice',
        rawPayload: { sensitive: true },
        operation: 'sweepAbandonedGames',
      });

      expect(payload.context).toEqual({
        roomCode: 'ABCD',
        operation: 'sweepAbandonedGames',
      });
      expect(payload.context).not.toHaveProperty('guestToken');
      expect(payload.context).not.toHaveProperty('displayName');
      expect(payload.context).not.toHaveProperty('rawPayload');
    });

    it('allows safe context keys', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload(new Error('test'), {
        roomCode: 'ABCD',
        roomId: 'room_123',
        operation: 'generateLineForRound',
        poemId: 'poem_456',
        source: 'convex/ai',
        status: 500,
        durationMs: 200,
        round: 3,
      });

      expect(payload.context).toEqual({
        roomCode: 'ABCD',
        roomId: 'room_123',
        operation: 'generateLineForRound',
        poemId: 'poem_456',
        source: 'convex/ai',
        status: 500,
        durationMs: 200,
      });
    });

    it('returns undefined context when all keys are unsafe', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload(new Error('test'), {
        displayName: 'Alice',
        guestToken: 'abc',
        rawData: {},
      });

      expect(payload.context).toBeUndefined();
    });

    it('returns undefined context when none provided', async () => {
      const mod = await canaryModule();
      const payload = mod.buildBackendCanaryPayload(new Error('test'));

      expect(payload.context).toBeUndefined();
    });
  });

  describe('sendBackendCanaryPayload', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends a correctly-structured POST to Canary', async () => {
      process.env.CANARY_API_KEY = 'sk-test';
      process.env.CANARY_ENDPOINT = 'https://canary.test';
      process.env.CONVEX_CLOUD_URL = 'https://linejam.convex.cloud';

      const mod = await canaryModule();
      await mod.sendBackendCanaryPayload({
        errorClass: 'Error',
        message: 'test error',
        severity: 'error',
        stackTrace: 'Error: test error\n    at Object.<anonymous>',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://canary.test/api/v1/errors');

      const body = JSON.parse(init.body);
      expect(body.service).toBe('linejam');
      expect(body.environment).toBe('production');
      expect(body.error_class).toBe('Error');
      expect(body.message).toBe('test error');
      expect(body.severity).toBe('error');
      expect(body.stack_trace).toBeDefined();
      expect(init.headers.Authorization).toBe('Bearer sk-test');
    });

    it('includes context in the payload', async () => {
      process.env.CANARY_API_KEY = 'sk-test';

      const mod = await canaryModule();
      await mod.sendBackendCanaryPayload({
        errorClass: 'Error',
        message: 'test',
        severity: 'warning',
        context: { roomCode: 'ABCD', operation: 'test' },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.context).toEqual({ roomCode: 'ABCD', operation: 'test' });
    });

    it('is silent when CANARY_API_KEY is not configured', async () => {
      delete process.env.CANARY_API_KEY;

      const mod = await canaryModule();
      await mod.sendBackendCanaryPayload({
        errorClass: 'Error',
        message: 'test',
        severity: 'error',
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not throw when the Canary API call fails', async () => {
      process.env.CANARY_API_KEY = 'sk-test';
      fetchMock.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mod = await canaryModule();
      await expect(
        mod.sendBackendCanaryPayload({
          errorClass: 'Error',
          message: 'test',
          severity: 'error',
        })
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('does not throw when the Canary API returns a non-OK status', async () => {
      process.env.CANARY_API_KEY = 'sk-test';
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mod = await canaryModule();
      await expect(
        mod.sendBackendCanaryPayload({
          errorClass: 'Error',
          message: 'test',
          severity: 'error',
        })
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('sends request with a 2-second timeout signal', async () => {
      process.env.CANARY_API_KEY = 'sk-test';

      const mod = await canaryModule();
      await mod.sendBackendCanaryPayload({
        errorClass: 'Error',
        message: 'test',
        severity: 'error',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0][1];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
