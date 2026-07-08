'use client';

import { useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import { trackPoemImageSaved } from '@/lib/analytics';
import { getAppliedTheme } from '@/lib/themes';

export type SaveImageStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * "Save as image" for a poem's themed artifact card
 * (`/poem/[id]/card`, rendered by lib/poemCard/PoemCard.tsx). Prefers the
 * Web Share API with a file attachment — that is what actually lands the
 * PNG in a phone's camera roll / share sheet (criterion 1); falls back to a
 * plain browser download where `navigator.share` with files isn't
 * available (most desktop browsers).
 *
 * Reads the theme via `getAppliedTheme()` (a DOM read) rather than
 * `useTheme()` — this hook has no reason to require a `ThemeProvider`
 * ancestor, and `getAppliedTheme()` degrades to the kenya/light default the
 * card route already falls back to when nothing is applied yet (SSR, tests).
 */
export function useSavePoemImage(poemId: Id<'poems'>, guestToken?: string) {
  const [status, setStatus] = useState<SaveImageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const enablePublicPoemShare = useMutation(api.shares.enablePublicPoemShare);

  const handleSaveImage = useCallback(async () => {
    setStatus('saving');
    setError(null);

    try {
      await enablePublicPoemShare({
        poemId,
        guestToken: guestToken || undefined,
      });

      const applied = getAppliedTheme();
      const url = applied
        ? `/poem/${poemId}/card?theme=${encodeURIComponent(applied.themeId)}&mode=${applied.mode}`
        : `/poem/${poemId}/card`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Card render failed (${response.status})`);
      }
      const blob = await response.blob();
      const file = new File([blob], `linejam-poem.png`, { type: 'image/png' });

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: 'Linejam poem' });
          setStatus('saved');
          trackPoemImageSaved({ method: 'native-share' });
          return;
        } catch (shareErr) {
          if (
            shareErr instanceof DOMException &&
            shareErr.name === 'AbortError'
          ) {
            setStatus('idle');
            return;
          }
          // Fall through to download if the share sheet itself errors.
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'linejam-poem.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      setStatus('saved');
      trackPoemImageSaved({ method: 'download' });
    } catch (err) {
      setStatus('error');
      setError('Failed to save image. Please try again.');
      captureError(err, { operation: 'savePoemImage', poemId });
    }
  }, [enablePublicPoemShare, poemId, guestToken]);

  return {
    handleSaveImage,
    saving: status === 'saving',
    saved: status === 'saved',
    saveError: error,
  };
}
