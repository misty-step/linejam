import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharePoem } from '../../hooks/useSharePoem';
import type { Id } from '../../convex/_generated/dataModel';

// Mock convex/react
const mockLogShare = vi.fn().mockResolvedValue(undefined);
vi.mock('convex/react', () => ({
  useMutation: () => mockLogShare,
}));

// Mock sentry
const mockCaptureError = vi.fn();
vi.mock('../../lib/sentry', () => ({
  captureError: (err: unknown, context: unknown) =>
    mockCaptureError(err, context),
}));

describe('useSharePoem', () => {
  const testPoemId = 'poem123' as Id<'poems'>;
  let originalClipboard: Clipboard;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Store originals
    originalClipboard = navigator.clipboard;
    originalLocation = window.location;

    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
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
  });

  it('returns initial state with copied=false', () => {
    const { result } = renderHook(() => useSharePoem(testPoemId));

    expect(result.current.copied).toBe(false);
    expect(typeof result.current.handleShare).toBe('function');
  });

  it('copies URL to clipboard when handleShare is called', async () => {
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123'
    );
  });

  it('sets copied=true after successful copy', async () => {
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.copied).toBe(true);
  });

  it('resets copied to false after 2000ms timeout', async () => {
    const { result } = renderHook(() => useSharePoem(testPoemId));

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
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockLogShare).toHaveBeenCalledWith({ poemId: testPoemId });
  });

  it('handles logShare mutation failure gracefully', async () => {
    mockLogShare.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useSharePoem(testPoemId));

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
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockCaptureError).toHaveBeenCalledWith(clipboardError, {
      operation: 'sharePoem',
      poemId: testPoemId,
    });
    expect(result.current.copied).toBe(false); // Copy failed, so copied stays false
  });

  it('does not log share when clipboard fails', async () => {
    (
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Clipboard denied'));
    const { result } = renderHook(() => useSharePoem(testPoemId));

    await act(async () => {
      await result.current.handleShare();
    });

    // logShare should not be called since clipboard failed
    expect(mockLogShare).not.toHaveBeenCalled();
  });
});
