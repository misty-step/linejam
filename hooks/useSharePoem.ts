'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import { trackPoemShared } from '@/lib/analytics';
import { useShareLink } from '@/hooks/useShareLink';

export function useSharePoem(poemId: Id<'poems'>, guestToken?: string) {
  const enablePublicPoemShare = useMutation(api.shares.enablePublicPoemShare);
  const logShare = useMutation(api.shares.logShare);

  return useShareLink({
    beforeShare: async () => {
      await enablePublicPoemShare({
        poemId,
        guestToken: guestToken || undefined,
      });
    },
    getShareData: () => ({
      url: `${window.location.origin}/poem/${poemId}`,
      title: 'Linejam poem',
      text: 'Read this poem from our Linejam session.',
    }),
    onShared: (method) => {
      logShare({ poemId }).catch(() => {});
      trackPoemShared({ method });
    },
    onError: (err) => {
      captureError(err, { operation: 'sharePoem', poemId });
    },
    failureMessage: 'Failed to share poem. Please try again.',
  });
}
