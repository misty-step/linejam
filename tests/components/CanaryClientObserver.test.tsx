// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { CanaryClientObserver } from '@/components/CanaryClientObserver';

const fetchMock = vi.fn();

describe('CanaryClientObserver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_CANARY_API_KEY', 'sk_test_canary');
    vi.stubEnv('NEXT_PUBLIC_CANARY_ENDPOINT', 'https://canary.test/');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    window.history.replaceState({}, '', '/room/ABCD');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports uncaught browser errors to Canary', async () => {
    render(<CanaryClientObserver />);

    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('client boom'),
        message: 'client boom',
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      context?: Record<string, unknown>;
      message: string;
    };

    expect(body.message).toBe('client boom');
    expect(body.context).toEqual({
      source: 'window.error',
      path: '/room/ABCD',
    });
  });

  it('falls back to a default message when browser error has no error object', async () => {
    render(<CanaryClientObserver />);

    window.dispatchEvent(new ErrorEvent('error', { message: '' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      message: string;
    };

    expect(body.message).toBe('Unhandled browser error');
  });

  it('reports unhandled promise rejections to Canary', async () => {
    render(<CanaryClientObserver />);

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', {
      value: new Error('rejected boom'),
      configurable: true,
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      context?: Record<string, unknown>;
      message: string;
    };

    expect(body.message).toBe('rejected boom');
    expect(body.context).toEqual({
      source: 'window.unhandledrejection',
      path: '/room/ABCD',
    });
  });

  it('falls back when unhandled rejection reason is missing', async () => {
    render(<CanaryClientObserver />);

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', {
      value: undefined,
      configurable: true,
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      message: string;
    };

    expect(body.message).toBe('Unhandled promise rejection');
  });

  it('removes event listeners on unmount', async () => {
    const { unmount } = render(<CanaryClientObserver />);
    unmount();

    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('post-unmount error'),
        message: 'post-unmount error',
      })
    );

    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', {
      value: new Error('post-unmount rejection'),
      configurable: true,
    });
    window.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
