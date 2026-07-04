// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharePoem } from '../../hooks/useSharePoem';
import type { Id } from '../../convex/_generated/dataModel';

// Mock convex/react
const mockEnablePublicPoemShare = vi.fn().mockResolvedValue(undefined);
const mockLogShare = vi.fn().mockResolvedValue(undefined);
let mutationCallCount = 0;
vi.mock('convex/react', () => ({
  useMutation: () => {
    mutationCallCount++;
    return mutationCallCount % 2 === 1
      ? mockEnablePublicPoemShare
      : mockLogShare;
  },
}));

// Mock lib/error's captureError
const mockCaptureError = vi.fn();
vi.mock('@/lib/error', () => ({
  captureError: (err: unknown, context: unknown) =>
    mockCaptureError(err, context),
}));

const mockTrackPoemShared = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackPoemShared: (props: unknown) => mockTrackPoemShared(props),
}));

describe('useSharePoem', () => {
  const testPoemId = 'poem123' as Id<'poems'>;
  const openingLine = 'The moon hums';
  let originalClipboard: Clipboard;
  let originalLocation: Location;
  let originalShare: Navigator['share'];

  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallCount = 0;
    mockEnablePublicPoemShare.mockResolvedValue(undefined);
    mockLogShare.mockResolvedValue(undefined);
    vi.useFakeTimers();

    // Store originals
    originalClipboard = navigator.clipboard;
    originalLocation = window.location;
    originalShare = navigator.share;

    // Mock clipboard
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

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore originals
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
  });

  it('returns initial state with copied=false', () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    expect(result.current.copied).toBe(false);
    expect(typeof result.current.handleShare).toBe('function');
  });

  it('copies URL to clipboard when handleShare is called', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123'
    );
    expect(mockEnablePublicPoemShare).toHaveBeenCalledWith({
      poemId: testPoemId,
      guestToken: undefined,
    });
  });

  it('sets copied=true after successful copy', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.copied).toBe(true);
  });

  it('resets copied to false after 2000ms timeout', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.copied).toBe(true);

    // Advance timers by 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('logs share via mutation (fire-and-forget)', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockLogShare).toHaveBeenCalledWith({ poemId: testPoemId });
    expect(mockTrackPoemShared).toHaveBeenCalledWith({ method: 'clipboard' });
  });

  it('does not copy when public sharing cannot be enabled', async () => {
    mockEnablePublicPoemShare.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(mockLogShare).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
  });

  it('handles logShare mutation failure gracefully', async () => {
    mockLogShare.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    // Should not throw, mutation error is caught
    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.copied).toBe(true); // Copy still succeeded
    expect(mockCaptureError).not.toHaveBeenCalled(); // Analytics error not captured
  });

  it('captures error when clipboard copy fails', async () => {
    const clipboardError = new Error('Clipboard write failed');
    (
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(clipboardError);
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockCaptureError).toHaveBeenCalledWith(clipboardError, {
      operation: 'sharePoem',
      poemId: testPoemId,
    });
    expect(result.current.copied).toBe(false); // Copy failed, so copied stays false
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
  });

  it('does not log share when clipboard fails', async () => {
    (
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Clipboard denied'));
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    // logShare should not be called since clipboard failed
    expect(mockLogShare).not.toHaveBeenCalled();
  });

  it('uses native share when available', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(nativeShare).toHaveBeenCalledWith({
      title: 'Linejam poem',
      text: 'Read "The moon hums" from our Linejam session.',
      url: 'https://example.com/poem/poem123',
    });
    expect(mockEnablePublicPoemShare).toHaveBeenCalledWith({
      poemId: testPoemId,
      guestToken: undefined,
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.shared).toBe(true);
    expect(mockTrackPoemShared).toHaveBeenCalledWith({
      method: 'native-share',
    });
  });

  it('falls back to clipboard when native share fails', async () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new Error('Share sheet unavailable')),
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123'
    );
    expect(result.current.copied).toBe(true);
  });

  it('does not surface an error when native share is cancelled', async () => {
    const abortError = new DOMException('Cancelled', 'AbortError');
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortError),
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.shareError).toBeNull();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('uses a generic fallback only when the opening line is unavailable', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(nativeShare).toHaveBeenCalledWith({
      title: 'Linejam poem',
      text: 'Read this poem from our Linejam session.',
      url: 'https://example.com/poem/poem123',
    });
  });
});
