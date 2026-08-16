// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSharePoem,
  type UseSharePoemDependencies,
} from '../../hooks/useSharePoem';
import type { ShareLinkClient } from '@/hooks/useShareLink';
import type { Id } from '../../convex/_generated/dataModel';

const mockPreparePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ slug: 'slug-1', nonce: 'nonce-1' });
const mockActivatePublicPoemShare = vi
  .fn()
  .mockResolvedValue({ publicShareEnabled: true, changed: true });
const mockCancelPublicPoemShare = vi
  .fn()
  .mockResolvedValue({ cancelled: true, publicShareEnabled: false });
const mockDisablePublicPoemShare = vi.fn().mockResolvedValue({
  publicShareEnabled: false,
  changed: true,
  publicShareDisabledAt: 1,
});

const captureErrorSpy = vi.fn();
const trackPoemSharedSpy = vi.fn();
const trackArtifactActionSpy = vi.fn();
let mockWriteText = vi.fn().mockResolvedValue(undefined);
let shareClient: ShareLinkClient;
let dependencies: UseSharePoemDependencies;

function renderSharePoemHook(
  poemId: Id<'poems'>,
  guestToken?: string,
  openingLine?: string,
  roomId?: string,
  cycle?: number
) {
  return renderHook(() =>
    useSharePoem(poemId, guestToken, openingLine, roomId, cycle, dependencies)
  );
}

describe('useSharePoem', () => {
  // SAFETY: Synthetic Convex document id fixture for poem sharing hook tests.
  const testPoemId = 'poem123' as Id<'poems'>;
  const openingLine = 'The moon hums';

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
    mockCancelPublicPoemShare.mockResolvedValue({
      cancelled: true,
      publicShareEnabled: false,
    });
    mockDisablePublicPoemShare.mockResolvedValue({
      publicShareEnabled: false,
      changed: true,
      publicShareDisabledAt: 1,
    });
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    shareClient = { writeClipboardText: mockWriteText };
    dependencies = {
      useMutations: () => ({
        prepare: mockPreparePublicPoemShare,
        activate: mockActivatePublicPoemShare,
        cancel: mockCancelPublicPoemShare,
        disable: mockDisablePublicPoemShare,
      }),
      shareClient,
      getOrigin: () => 'https://example.com',
      captureError: captureErrorSpy,
      trackPoemShared: trackPoemSharedSpy,
      trackArtifactAction: trackArtifactActionSpy,
      hashRoomId: () => 'test-room-hash',
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state with copied=false', () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    expect(result.current.copied).toBe(false);
    expect(result.current.handleShare).toBeInstanceOf(Function);
  });

  it('copies URL to clipboard when handleShare is called', async () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockWriteText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123?share=slug-1'
    );
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockActivatePublicPoemShare).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent share attempts into one publication', async () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await Promise.all([
        result.current.handleShare(),
        result.current.handleShare(),
      ]);
    });

    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockWriteText).toHaveBeenCalledOnce();
    expect(mockActivatePublicPoemShare).toHaveBeenCalledOnce();
    expect(trackPoemSharedSpy).toHaveBeenCalledOnce();
  });

  it('does not report success when activation loses the publication race', async () => {
    mockActivatePublicPoemShare.mockResolvedValueOnce({
      publicShareEnabled: false,
      changed: false,
    });
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockWriteText).toHaveBeenCalledWith(
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
    expect(trackPoemSharedSpy).not.toHaveBeenCalled();
    expect(captureErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Share activation expired or was superseded',
      }),
      { operation: 'sharePoem', poemId: testPoemId }
    );
  });

  it('revokes the public share through the disable mutation', async () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.revokeShare();
    });

    expect(mockDisablePublicPoemShare).toHaveBeenCalledWith({
      poemId: testPoemId,
      guestToken: undefined,
    });
  });

  it('sets copied=true after successful copy', async () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.copied).toBe(true);
  });

  it('resets copied to false after 2000ms timeout', async () => {
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

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
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(trackPoemSharedSpy).toHaveBeenCalledWith({ method: 'clipboard' });
  });

  it('reports an error when the copied private link cannot be published', async () => {
    mockActivatePublicPoemShare.mockRejectedValueOnce(new Error('Forbidden'));
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(mockWriteText).toHaveBeenCalledWith(
      'https://example.com/poem/poem123?share=slug-1'
    );
    expect(trackPoemSharedSpy).not.toHaveBeenCalled();
    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
  });

  it('captures error when clipboard copy fails', async () => {
    const clipboardError = new Error('Clipboard write failed');
    mockWriteText.mockRejectedValueOnce(clipboardError);
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(captureErrorSpy).toHaveBeenCalledWith(clipboardError, {
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
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(trackPoemSharedSpy).not.toHaveBeenCalled();
  });

  it('uses native share when available', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    shareClient.nativeShare = nativeShare;
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

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
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(result.current.shared).toBe(true);
    expect(trackPoemSharedSpy).toHaveBeenCalledWith({
      method: 'native-share',
    });
  });

  it('keeps a failed native share private', async () => {
    shareClient.nativeShare = vi
      .fn()
      .mockRejectedValue(new Error('Share sheet unavailable'));
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);
    await act(async () => {
      await result.current.handleShare();
    });
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
  });

  it('does not surface an error when native share is cancelled', async () => {
    const abortError = new DOMException('Cancelled', 'AbortError');
    shareClient.nativeShare = vi.fn().mockRejectedValue(abortError);
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      await result.current.handleShare();
    });

    expect(result.current.shareError).toBeNull();
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(mockPreparePublicPoemShare).toHaveBeenCalledOnce();
    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(trackPoemSharedSpy).not.toHaveBeenCalled();
    expect(captureErrorSpy).not.toHaveBeenCalled();
  });

  it('rolls back and reports an error when native share times out', async () => {
    shareClient.nativeShare = vi.fn(() => new Promise<void>(() => undefined));
    const { result } = renderSharePoemHook(testPoemId, undefined, openingLine);

    await act(async () => {
      const share = result.current.handleShare();
      await vi.advanceTimersByTimeAsync(30_000);
      await share;
    });

    expect(mockCancelPublicPoemShare).toHaveBeenCalledOnce();
    expect(mockActivatePublicPoemShare).not.toHaveBeenCalled();
    expect(result.current.shareError).toBe(
      'Failed to share poem. Please try again.'
    );
    expect(captureErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Native share timed out' }),
      { operation: 'sharePoem', poemId: testPoemId }
    );
  });

  it('truncates a long opening line in the share text preview', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    shareClient.nativeShare = nativeShare;
    const longOpeningLine =
      'The moon hums a long forgotten tune while the tide pulls back from the shore, again and again, patient as ever';
    const { result } = renderSharePoemHook(
      testPoemId,
      undefined,
      longOpeningLine
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
    shareClient.nativeShare = nativeShare;
    const { result } = renderSharePoemHook(testPoemId);

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
    const { result } = renderSharePoemHook(
      testPoemId,
      undefined,
      openingLine,
      'room-id',
      2
    );
    await act(async () => {
      await result.current.handleShare();
    });
    expect(trackArtifactActionSpy).toHaveBeenCalledWith({
      roomIdHash: 'test-room-hash',
      cycle: 2,
      round: 8,
      action: 'share',
    });
  });
});
