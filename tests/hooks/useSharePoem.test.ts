// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharePoem } from '../../hooks/useSharePoem';
import type { Id } from '../../convex/_generated/dataModel';

// Mock Convex mutations independently so prepare/activate/cancel ordering is observable.
const mockApiRefs = vi.hoisted(() => ({
  prepare: {},
  activate: {},
  cancel: {},
  disable: {},
}));
const mockPreparePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ slug: 'slug-1', nonce: 'nonce-1' });
const mockActivatePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ publicShareEnabled: true, changed: true });
const mockCancelPublicPoemShare = vi.fn().mockResolvedValue(undefined);
const mockDisablePublicPoemShare = vi.fn().mockResolvedValue(undefined);
vi.mock('@/convex/_generated/api', () => ({
  api: {
    shares: {
      preparePublicPoemShare: mockApiRefs.prepare,
      activatePublicPoemShare: mockApiRefs.activate,
      cancelPublicPoemShare: mockApiRefs.cancel,
      disablePublicPoemShare: mockApiRefs.disable,
    },
  },
}));
vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => {
    if (ref === mockApiRefs.prepare) return mockPreparePublicPoemShare;
    if (ref === mockApiRefs.activate) return mockActivatePublicPoemShare;
    if (ref === mockApiRefs.cancel) return mockCancelPublicPoemShare;
    if (ref === mockApiRefs.disable) return mockDisablePublicPoemShare;
    throw new Error('Unexpected mutation reference');
  },
}));

// Mock lib/error's captureError
const mockCaptureError = vi.fn();
vi.mock('@/lib/error', () => ({
  captureError: (err: unknown, context: unknown) =>
    mockCaptureError(err, context),
}));

const mockTrackPoemShared = vi.fn();
const mockTrackArtifactAction = vi.fn();
vi.mock('@/lib/analytics', () => ({
  hashRoomId: () => 'test-room-hash',
  trackArtifactAction: (props: unknown) => mockTrackArtifactAction(props),
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
    mockPreparePublicPoemShare.mockResolvedValue({
      slug: 'slug-1',
      nonce: 'nonce-1',
    });
    mockActivatePublicPoemShare.mockResolvedValue({
      publicShareEnabled: true,
      changed: true,
    });
    mockCancelPublicPoemShare.mockResolvedValue(undefined);
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
      'https://example.com/poem/poem123?share=slug-1'
    );
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockActivatePublicPoemShare).toHaveBeenCalledOnce();
  });

  it('does not report success when activation loses the publication race', async () => {
    mockActivatePublicPoemShare.mockResolvedValueOnce({
      publicShareEnabled: false,
      changed: false,
    });
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123?share=slug-1'
    );
    expect(mockCancelPublicPoemShare).toHaveBeenCalledWith({
      poemId: testPoemId,
      slug: 'slug-1',
      nonce: 'nonce-1',
      guestToken: undefined,
    });
    expect(result.current.copied).toBe(false);
    expect(result.current.shared).toBe(false);
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
    expect(mockTrackPoemShared).not.toHaveBeenCalled();
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Share activation expired or was superseded',
      }),
      { operation: 'sharePoem', poemId: testPoemId }
    );
  });

  it('revokes the public share through the disable mutation', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.revokeShare();
    });

    expect(mockDisablePublicPoemShare).toHaveBeenCalledWith({
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

  it('records a successful share through provider-portable analytics', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockTrackPoemShared).toHaveBeenCalledWith({ method: 'clipboard' });
  });

  it('reports an error when the copied private link cannot be published', async () => {
    mockActivatePublicPoemShare.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123?share=slug-1'
    );
    expect(mockTrackPoemShared).not.toHaveBeenCalled();
    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
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
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(result.current.copied).toBe(false); // Copy failed, so copied stays false
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
  });

  it('does not record a share when clipboard fails', async () => {
    (
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Clipboard denied'));
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockTrackPoemShared).not.toHaveBeenCalled();
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
      url: 'https://example.com/poem/poem123?share=slug-1',
    });
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockActivatePublicPoemShare).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.shared).toBe(true);
    expect(mockTrackPoemShared).toHaveBeenCalledWith({
      method: 'native-share',
    });
  });

  it('keeps a failed native share private', async () => {
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
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
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
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(mockTrackPoemShared).not.toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('truncates a long opening line in the share text preview', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    const longOpeningLine =
      'The moon hums a long forgotten tune while the tide pulls back from the shore, again and again, patient as ever';
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, longOpeningLine)
    );

    await act(async () => {
      await result.current.handleShare();
    });

    expect(nativeShare).toHaveBeenCalledWith({
      title: 'Linejam poem',
      text: `Read "${longOpeningLine.slice(0, 77)}..." from our Linejam session.`,
      url: 'https://example.com/poem/poem123?share=slug-1',
    });
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
      url: 'https://example.com/poem/poem123?share=slug-1',
    });
  });

  it('emits a canonical share action only after a successful share', async () => {
    const { result } = renderHook(() =>
      useSharePoem(testPoemId, undefined, openingLine, 'room-id', 2, 'human')
    );
    await act(async () => {
      await result.current.handleShare();
    });
    expect(mockTrackArtifactAction).toHaveBeenCalledWith({
      roomIdHash: 'test-room-hash',
      cycle: 2,
      round: 8,
      playerKind: 'human',
      action: 'share',
    });
  });
});
