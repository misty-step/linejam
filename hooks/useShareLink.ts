'use client';

import { useEffect, useRef, useState } from 'react';

export type ShareMethod = 'clipboard' | 'native-share';
type ShareStatus = 'idle' | 'copied' | 'shared' | 'error';

interface ShareData {
  url: string;
  title?: string;
  text?: string;
}
interface UseShareLinkOptions {
  getShareData: () => ShareData;
  publishShare?: () => Promise<void>;
  /** Mint an inert URL before opening the native share sheet. */
  prepareShare?: () => Promise<void>;
  /** Activate the inert URL after native delivery succeeds. */
  commitShare?: () => Promise<void>;
  /** Cancel an inert URL after native delivery fails or is cancelled. */
  rollbackShare?: () => Promise<void>;
  onShared?: (method: ShareMethod) => void | Promise<void>;
  onError?: (error: unknown) => void;
  failureMessage?: string;
  successDurationMs?: number;
}

const NATIVE_SHARE_TIMEOUT_MS = 30_000;

export function useShareLink({
  getShareData,
  publishShare,
  prepareShare,
  commitShare,
  rollbackShare,
  onShared,
  onError,
  failureMessage = 'Failed to share link. Please try again.',
  successDurationMs = 2000,
}: UseShareLinkOptions) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharingRef = useRef(false);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    },
    []
  );

  const resetStatusSoon = () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      resetTimeoutRef.current = null;
    }, successDurationMs);
  };

  const notifyShared = (method: ShareMethod) => {
    if (onShared) Promise.resolve(onShared(method)).catch(() => {});
  };

  const completeShare = async (method: ShareMethod, staged = false) => {
    if (staged) await commitShare?.();
    else await publishShare?.();
    setStatus(method === 'native-share' ? 'shared' : 'copied');
    notifyShared(method);
    resetStatusSoon();
  };

  const handleShare = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setShareError(null);
    let staged = false;
    let data = getShareData();

    const stage = async () => {
      if (!prepareShare) return;
      await prepareShare();
      staged = true;
      data = getShareData();
    };

    const rollback = async () => {
      if (!staged) return;
      staged = false;
      try {
        await rollbackShare?.();
      } catch {
        // A failed rollback cannot expose content: the slug remains inactive.
      }
    };

    try {
      if (typeof navigator.share === 'function') {
        let nativeSucceeded = false;
        try {
          await stage();
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              navigator.share(data),
              new Promise<never>((_, reject) => {
                timeout = setTimeout(
                  () => reject(new Error('Native share timed out')),
                  NATIVE_SHARE_TIMEOUT_MS
                );
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
          nativeSucceeded = true;
        } catch (error) {
          await rollback();
          if (error instanceof DOMException && error.name === 'AbortError')
            return;
          if (prepareShare) throw error;
        }
        if (nativeSucceeded) {
          // Do not fall through to clipboard if activation reports an error
          // after the OS has already delivered the share.
          await completeShare('native-share', staged);
          return;
        }
      }

      if (navigator.clipboard?.writeText) {
        await stage();
        await navigator.clipboard.writeText(data.url);
        await completeShare('clipboard', staged);
        return;
      }
      throw new Error('Clipboard is unavailable');
    } catch (error) {
      await rollback();
      setStatus('error');
      setShareError(failureMessage);
      onError?.(error);
    } finally {
      sharingRef.current = false;
    }
  };

  return {
    copied: status === 'copied',
    shared: status === 'shared',
    shareError,
    handleShare,
  };
}
