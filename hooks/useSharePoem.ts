'use client';

import { useMutation } from 'convex/react';
import { useRef } from 'react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import {
  hashRoomId,
  trackArtifactAction,
  trackPoemShared,
} from '@/lib/analytics';
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
  openingLine?: string,
  roomId?: string,
  cycle = 1,
  playerKind: 'human' | 'AI' = 'human'
) {
  const preparePublicPoemShare = useMutation(api.shares.preparePublicPoemShare);
  const activatePublicPoemShare = useMutation(
    api.shares.activatePublicPoemShare
  );
  const cancelPublicPoemShare = useMutation(api.shares.cancelPublicPoemShare);
  const disablePublicPoemShare = useMutation(api.shares.disablePublicPoemShare);
  const pendingShareRef = useRef(
    null as { slug: string; nonce: string } | null
  );

  const share = useShareLink({
    prepareShare: async () => {
      pendingShareRef.current = await preparePublicPoemShare({
        poemId,
        guestToken: guestToken || undefined,
      });
    },
    commitShare: async () => {
      const pending = pendingShareRef.current;
      if (!pending) throw new Error('Share preparation missing');
      await activatePublicPoemShare({
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
        guestToken: guestToken || undefined,
      });
      pendingShareRef.current = null;
    },
    rollbackShare: async () => {
      const pending = pendingShareRef.current;
      if (!pending) return;
      try {
        await cancelPublicPoemShare({
          poemId,
          slug: pending.slug,
          nonce: pending.nonce,
          guestToken: guestToken || undefined,
        });
      } finally {
        pendingShareRef.current = null;
      }
    },
    getShareData: () => ({
      url:
        window.location.origin +
        '/poem/' +
        poemId +
        (pendingShareRef.current
          ? '?share=' + encodeURIComponent(pendingShareRef.current.slug)
          : ''),
      title: 'Linejam poem',
      text: buildPoemShareText(openingLine),
    }),
    onShared: (method) => {
      trackPoemShared({ method });
      if (roomId) {
        trackArtifactAction({
          roomIdHash: hashRoomId(roomId),
          cycle,
          round: 8,
          playerKind,
          action: 'share',
        });
      }
    },
    onError: (err) => {
      captureError(err, { operation: 'sharePoem', poemId });
    },
    failureMessage: 'Failed to share poem. Please try again.',
  });

  return {
    ...share,
    revokeShare: async () => {
      await disablePublicPoemShare({
        poemId,
        guestToken: guestToken || undefined,
      });
    },
  };
}
