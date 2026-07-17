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
  it('rolls back when native share preparation fails', async () => {
    const prepareShare = vi.fn().mockRejectedValue(new Error('Prepare failed'));
    const rollbackShare = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        prepareShare,
        rollbackShare,
        onError,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(prepareShare).toHaveBeenCalledOnce();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(rollbackShare).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share link. Please try again.'
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Prepare failed' })
    );
  });

  it('rolls back a staged native share that times out', async () => {
    const prepareShare = vi.fn().mockResolvedValue(undefined);
    const rollbackShare = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockImplementation(() => new Promise(() => {})),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        prepareShare,
        rollbackShare,
        onError,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );
    const sharing = result.current.handleShare();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(30_000);
      await sharing;
    });

    expect(rollbackShare).toHaveBeenCalledOnce();
    expect(result.current.shareError).toBe(
      'Failed to share link. Please try again.'
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Native share timed out' })
    );
  });

  it('rolls back a staged clipboard share when clipboard is unavailable', async () => {
    const prepareShare = vi.fn().mockResolvedValue(undefined);
    const rollbackShare = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        prepareShare,
        rollbackShare,
        onError,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(prepareShare).not.toHaveBeenCalled();
    expect(rollbackShare).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share link. Please try again.'
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Clipboard is unavailable' })
    );
  });

  it('keeps a staged native failure private without clipboard fallback', async () => {
    const prepareShare = vi.fn().mockResolvedValue(undefined);
    const rollbackShare = vi.fn().mockResolvedValue(undefined);
    const nativeError = new Error('Native share failed');
    const onError = vi.fn();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(nativeError),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useShareLink({
        prepareShare,
        rollbackShare,
        onError,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(rollbackShare).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share link. Please try again.'
    );
    expect(onError).toHaveBeenCalledWith(nativeError);
  });

  it('keeps the original error when rollback itself fails', async () => {
    const clipboardError = new Error('Clipboard denied');
    const prepareShare = vi.fn().mockResolvedValue(undefined);
    const rollbackShare = vi
      .fn()
      .mockRejectedValue(new Error('Rollback failed'));
    const onError = vi.fn();
    (
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(clipboardError);

    const { result } = renderHook(() =>
      useShareLink({
        prepareShare,
        rollbackShare,
        onError,
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(rollbackShare).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(clipboardError);
    expect(result.current.shareError).toBe(
      'Failed to share link. Please try again.'
    );
  });

  it('ignores a concurrent share request while one is in flight', async () => {
    let resolveWrite!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        })
    );
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() =>
      useShareLink({
        getShareData: () => ({ url: 'https://example.com/room/ABCD' }),
      })
    );

    const first = result.current.handleShare();
    const second = result.current.handleShare();
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledOnce();

    resolveWrite();
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(result.current.copied).toBe(true);
  });
});
