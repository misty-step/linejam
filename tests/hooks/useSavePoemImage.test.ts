// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavePoemImage } from '../../hooks/useSavePoemImage';
import type { Id } from '../../convex/_generated/dataModel';

const mockEnablePublicPoemShare = vi.fn().mockResolvedValue(undefined);
vi.mock('convex/react', () => ({
  useMutation: () => mockEnablePublicPoemShare,
}));

const mockCaptureError = vi.fn();
vi.mock('@/lib/error', () => ({
  captureError: (err: unknown, context: unknown) =>
    mockCaptureError(err, context),
}));

const mockTrackPoemImageSaved = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackPoemImageSaved: (props: unknown) => mockTrackPoemImageSaved(props),
}));

const mockGetAppliedTheme = vi.fn();
vi.mock('@/lib/themes', () => ({
  getAppliedTheme: () => mockGetAppliedTheme(),
}));

describe('useSavePoemImage', () => {
  const testPoemId = 'poem123' as Id<'poems'>;
  const pngBlob = () => new Blob(['fake-png'], { type: 'image/png' });

  let originalShare: Navigator['share'];
  let originalCanShare: Navigator['canShare'];
  let originalFetch: typeof global.fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnablePublicPoemShare.mockResolvedValue(undefined);
    mockGetAppliedTheme.mockReturnValue({ themeId: 'hyper', mode: 'dark' });

    originalShare = navigator.share;
    originalCanShare = navigator.canShare;
    originalFetch = global.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(pngBlob(), { status: 200 }));

    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: originalCanShare,
      configurable: true,
    });
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useSavePoemImage(testPoemId));
    expect(result.current.saving).toBe(false);
    expect(result.current.saved).toBe(false);
    expect(result.current.saveError).toBeNull();
  });

  it('fetches a participant-only card without enabling public sharing', async () => {
    const { result } = renderHook(() =>
      useSavePoemImage(testPoemId, 'guest-token')
    );

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(mockEnablePublicPoemShare).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/poem/poem123/card?theme=hyper&mode=dark',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken: 'guest-token' }),
      }
    );
  });

  it('falls back to the un-themed card route when no theme is applied yet', async () => {
    mockGetAppliedTheme.mockReturnValue(null);
    const { result } = renderHook(() => useSavePoemImage(testPoemId));

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(global.fetch).toHaveBeenCalledWith('/poem/poem123/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });

  it('downloads the PNG when the Web Share API is unavailable', async () => {
    const { result } = renderHook(() => useSavePoemImage(testPoemId));

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(result.current.saved).toBe(true);
    expect(mockTrackPoemImageSaved).toHaveBeenCalledWith({
      method: 'download',
    });
  });

  it('prefers the native share sheet with a file attachment when it can share files', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSavePoemImage(testPoemId));

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(nativeShare).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Linejam poem' })
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(result.current.saved).toBe(true);
    expect(mockTrackPoemImageSaved).toHaveBeenCalledWith({
      method: 'native-share',
    });
  });

  it('does not surface an error when the native share sheet is cancelled', async () => {
    const abortError = new DOMException('Cancelled', 'AbortError');
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortError),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSavePoemImage(testPoemId));

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(result.current.saveError).toBeNull();
    expect(result.current.saved).toBe(false);
    expect(mockEnablePublicPoemShare).not.toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('surfaces an error and captures it when the card route fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const { result } = renderHook(() => useSavePoemImage(testPoemId));

    await act(async () => {
      await result.current.handleSaveImage();
    });

    expect(result.current.saveError).toBe(
      'Failed to save image. Please try again.'
    );
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'savePoemImage',
        poemId: testPoemId,
      })
    );
  });
});
