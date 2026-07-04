'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import { trackPoemShared } from '@/lib/analytics';
import { useShareLink } from '@/hooks/useShareLink';

function buildPoemShareText(openingLine?: string) {
  const trimmed = openingLine?.trim();
  if (!trimmed) return 'Read this poem from our Linejam session.';

  const preview =
    trimmed.length > 80 ? `${trimmed.slice(0, 77).trimEnd()}...` : trimmed;
  return `Read "${preview}" from our Linejam session.`;
}

export function useSharePoem(
  poemId: Id<'poems'>,
  guestToken?: string,
  openingLine?: string
) {
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
      text: buildPoemShareText(openingLine),
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
