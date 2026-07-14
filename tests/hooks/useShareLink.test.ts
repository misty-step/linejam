// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useShareLink } from '@/hooks/useShareLink';

describe('useShareLink', () => {
  let originalClipboard: Clipboard;
  let originalShare: Navigator['share'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalClipboard = navigator.clipboard;
    originalShare = navigator.share;

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();

    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });

    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
  });

  it('clears the previous success timeout when sharing twice', async () => {
    const { result } = renderHook(() =>
      useShareLink({
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      await result.current.handleShare();
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.copied).toBe(false);
  });

  it('surfaces an error when no share method is available', async () => {
    const onError = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
        onError,
        failureMessage: 'Unable to share right now.',
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.shareError).toBe('Unable to share right now.');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0] ?? [])[0]).toMatchObject({
      message: 'Clipboard is unavailable',
    });
  });

  it('publishes only after the URL has been exposed successfully', async () => {
    const publishShare = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useShareLink({
        publishShare,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledBefore(
      publishShare as ReturnType<typeof vi.fn>
    );
  });

  it('reports an error when publication fails after copying the private URL', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useShareLink({
        publishShare: () => Promise.reject(new Error('Not allowed')),
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
        onError,
        failureMessage: 'Unable to publish link.',
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(result.current.shareError).toBe('Unable to publish link.');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not expose the URL twice when publication fails after native sharing', async () => {
    const publishError = new Error('Publication failed');
    const onError = vi.fn();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        publishShare: () => Promise.reject(publishError),
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
        onError,
        failureMessage: 'Unable to publish link.',
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(publishError);
    expect(result.current.shareError).toBe('Unable to publish link.');
  });

  it('does not publish when the native share sheet is cancelled', async () => {
    const publishShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: vi
        .fn()
        .mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        publishShare,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(publishShare).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.shareError).toBeNull();
  });
});
