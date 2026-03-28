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
  onShared?: (method: ShareMethod) => void | Promise<void>;
  onError?: (error: unknown) => void;
  failureMessage?: string;
  successDurationMs?: number;
}

export function useShareLink({
  getShareData,
  onShared,
  onError,
  failureMessage = 'Failed to share link. Please try again.',
  successDurationMs = 2000,
}: UseShareLinkOptions) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const resetStatusSoon = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      resetTimeoutRef.current = null;
    }, successDurationMs);
  };

  const notifyShared = (method: ShareMethod) => {
    if (!onShared) return;
    Promise.resolve(onShared(method)).catch(() => {});
  };

  const handleShare = async () => {
    setShareError(null);

    const { url, title, text } = getShareData();

    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url });
          setStatus('shared');
          notifyShared('native-share');
          resetStatusSoon();
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus('copied');
        notifyShared('clipboard');
        resetStatusSoon();
        return;
      }

      throw new Error('Clipboard is unavailable');
    } catch (error) {
      setStatus('error');
      setShareError(failureMessage);
      onError?.(error);
    }
  };

  return {
    copied: status === 'copied',
    shared: status === 'shared',
    shareError,
    handleShare,
  };
}
