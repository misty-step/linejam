'use client';

import { useMutation } from 'convex/react';
import { useRef } from 'react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { captureError } from '@/lib/error';
import type { ErrorReportable } from '@/lib/errorCore';
import {
  hashRoomId,
  trackArtifactAction,
  trackPoemShared,
} from '@/lib/analytics';
import { useShareLink, type ShareLinkClient } from '@/hooks/useShareLink';

interface PoemShareAccess {
  poemId: Id<'poems'>;
  guestToken?: string;
}

interface PreparedPoemShare {
  slug: string;
  nonce: string;
}

interface CancelledPoemShare {
  cancelled: boolean;
  publicShareEnabled: boolean;
}

interface DisabledPoemShare {
  publicShareEnabled: boolean;
  changed: boolean;
  publicShareDisabledAt?: number;
}

export interface PoemShareMutations {
  prepare(args: PoemShareAccess): Promise<PreparedPoemShare>;
  activate(
    args: PoemShareAccess & PreparedPoemShare
  ): Promise<{ changed: boolean }>;
  cancel(
    args: PoemShareAccess & PreparedPoemShare
  ): Promise<CancelledPoemShare>;
  disable(args: PoemShareAccess): Promise<DisabledPoemShare>;
}

export interface UseSharePoemDependencies {
  useMutations: () => PoemShareMutations;
  shareClient?: ShareLinkClient;
  getOrigin: () => string;
  captureError: (
    error: ErrorReportable,
    context: { operation: 'sharePoem'; poemId: Id<'poems'> }
  ) => void;
  trackPoemShared: (properties: {
    method: 'clipboard' | 'native-share';
  }) => void;
  trackArtifactAction: (properties: {
    roomIdHash: string;
    cycle: number;
    round: number;
    action: 'share';
  }) => void;
  hashRoomId: (roomId: string) => string;
}

function useDefaultPoemShareMutations(): PoemShareMutations {
  return {
    prepare: useMutation(api.shares.preparePublicPoemShare),
    activate: useMutation(api.shares.activatePublicPoemShare),
    cancel: useMutation(api.shares.cancelPublicPoemShare),
    disable: useMutation(api.shares.disablePublicPoemShare),
  };
}

const defaultDependencies: UseSharePoemDependencies = {
  useMutations: useDefaultPoemShareMutations,
  getOrigin: () => window.location.origin,
  captureError,
  trackPoemShared,
  trackArtifactAction,
  hashRoomId,
};

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
  dependencies: UseSharePoemDependencies = defaultDependencies
) {
  const mutations = dependencies.useMutations();
  const pendingShareRef = useRef<PreparedPoemShare | null>(null);

  const share = useShareLink({
    prepareShare: async () => {
      pendingShareRef.current = await mutations.prepare({
        poemId,
        guestToken: guestToken || undefined,
      });
    },
    commitShare: async () => {
      const pending = pendingShareRef.current;
      if (!pending) throw new Error('Share preparation missing');
      const activation = await mutations.activate({
        poemId,
        slug: pending.slug,
        nonce: pending.nonce,
        guestToken: guestToken || undefined,
      });
      if (activation.changed !== true) {
        throw new Error('Share activation expired or was superseded');
      }
      pendingShareRef.current = null;
    },
    rollbackShare: async () => {
      const pending = pendingShareRef.current;
      if (!pending) return;
      try {
        await mutations.cancel({
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
        dependencies.getOrigin() +
        '/poem/' +
        poemId +
        (pendingShareRef.current
          ? '?share=' + encodeURIComponent(pendingShareRef.current.slug)
          : ''),
      title: 'Linejam poem',
      text: buildPoemShareText(openingLine),
    }),
    onShared: (method) => {
      dependencies.trackPoemShared({ method });
      if (roomId) {
        dependencies.trackArtifactAction({
          roomIdHash: dependencies.hashRoomId(roomId),
          cycle,
          round: 8,
          action: 'share',
        });
      }
    },
    onError: (err) => {
      dependencies.captureError(err, { operation: 'sharePoem', poemId });
    },
    failureMessage: 'Failed to share poem. Please try again.',
    client: dependencies.shareClient,
  });

  return {
    ...share,
    revokeShare: async () => {
      await mutations.disable({
        poemId,
        guestToken: guestToken || undefined,
      });
    },
  };
}
