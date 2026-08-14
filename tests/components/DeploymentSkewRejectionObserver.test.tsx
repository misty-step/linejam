// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { DeploymentSkewRejectionObserver } from '@/components/DeploymentSkewRejectionObserver';

function rejectionEvent(reason: unknown) {
  const event = new Event('unhandledrejection', {
    cancelable: true,
  }) as PromiseRejectionEvent;
  Object.defineProperty(event, 'reason', {
    value: reason,
    configurable: true,
  });
  return event;
}

describe('DeploymentSkewRejectionObserver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps only the deployment-skew listener alongside Sentry globals', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');

    render(<DeploymentSkewRejectionObserver />);

    expect(addEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
    expect(addEventListener).not.toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
  });

  it('classifies stale Server Actions and prevents duplicate incident noise', async () => {
    render(<DeploymentSkewRejectionObserver />);
    const staleListener = vi.fn();
    window.addEventListener('linejam:deployment-stale', staleListener);
    const error = new Error(
      'Server Action "[redacted]" was not found on the server.'
    );
    error.name = 'UnrecognizedActionError';
    const event = rejectionEvent(error);

    window.dispatchEvent(event);

    await waitFor(() => expect(staleListener).toHaveBeenCalledTimes(1));
    expect(event.defaultPrevented).toBe(true);
    window.removeEventListener('linejam:deployment-stale', staleListener);
  });

  it('leaves ordinary rejections to the Sentry SDK global handler', () => {
    render(<DeploymentSkewRejectionObserver />);
    const event = rejectionEvent(new Error('ordinary rejection'));

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('removes the deployment-skew listener on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<DeploymentSkewRejectionObserver />);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
  });
});
