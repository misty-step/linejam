'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import { trackPoemShared } from '@/lib/analytics';

export function useSharePoem(poemId: Id<'poems'>) {
  const [copied, setCopied] = useState(false);
  const logShare = useMutation(api.shares.logShare);

  const handleShare = async () => {
    const url = `${window.location.origin}/poem/${poemId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Fire-and-forget analytics
      logShare({ poemId }).catch(() => {});
      trackPoemShared({ method: 'clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { operation: 'sharePoem', poemId });
    }
  };

  return { handleShare, copied };
}
