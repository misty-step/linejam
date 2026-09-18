'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import type { Id } from '../../../convex/_generated/dataModel';
import { PoemDisplay, type PoemLine } from '../../../components/PoemDisplay';
import { AuthErrorState } from '@/components/AuthErrorState';
import { playSound } from '@/lib/audio';

export interface PoemDetailData {
  poem: {
    createdAt: number;
    publicShareEnabled?: boolean;
  };
  lines: Array<{
    text: string;
    authorName: string;
    authorKey: string;
  }>;
}

export interface PoemShareStatus {
  state: string;
  expiresAt?: number;
}

interface FavoritePoemArgs {
  poemId: Id<'poems'>;
  guestToken?: string;
}
export type MutateFavorite = (args: FavoritePoemArgs) => Promise<void>;
export type DisablePublicShare = (args: FavoritePoemArgs) => Promise<void>;

function useDefaultUser() {
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  return { guestToken, isLoading, authError, retryAuth };
}

function useDefaultPoemDetail(
  poemId: Id<'poems'>,
  guestToken: string | undefined,
  enabled: boolean
): PoemDetailData | null | undefined {
  return useQuery(
    api.poems.getPoemDetail,
    enabled ? { poemId, guestToken } : 'skip'
  );
}

function useDefaultPublicPoem(
  poemId: Id<'poems'>,
  shareSlug?: string
): PoemDetailData | null | undefined {
  return useQuery(api.poems.getPublicPoemFull, { poemId, shareSlug });
}

function useDefaultShareStatus(
  shareSlug?: string
): PoemShareStatus | null | undefined {
  return useQuery(
    api.poems.getPublicPoemShareStatus,
    shareSlug ? { shareSlug } : 'skip'
  );
}

function useDefaultIsFavorited(
  poemId: Id<'poems'>,
  guestToken: string | undefined,
  isParticipant: boolean
): boolean | undefined {
  return useQuery(
    api.favorites.isFavorited,
    isParticipant ? { poemId, guestToken } : 'skip'
  );
}

function useDefaultToggleFavorite(): MutateFavorite {
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);
  return async (args) => {
    await toggleFavorite(args);
  };
}

function useDefaultDisablePublicShare(): DisablePublicShare {
  const disablePublicShare = useMutation(api.shares.disablePublicPoemShare);
  return async (args) => {
    await disablePublicShare(args);
  };
}

export interface PoemDetailDependencies {
  useUser: typeof useDefaultUser;
  usePoemDetail: typeof useDefaultPoemDetail;
  usePublicPoem: typeof useDefaultPublicPoem;
  useShareStatus: typeof useDefaultShareStatus;
  useIsFavorited: typeof useDefaultIsFavorited;
  useToggleFavorite: typeof useDefaultToggleFavorite;
  useDisablePublicShare: typeof useDefaultDisablePublicShare;
  PoemDisplayComponent: typeof PoemDisplay;
}

const defaultPoemDetailDependencies: PoemDetailDependencies = {
  useUser: useDefaultUser,
  usePoemDetail: useDefaultPoemDetail,
  usePublicPoem: useDefaultPublicPoem,
  useShareStatus: useDefaultShareStatus,
  useIsFavorited: useDefaultIsFavorited,
  PoemDisplayComponent: PoemDisplay,
  useToggleFavorite: useDefaultToggleFavorite,
  useDisablePublicShare: useDefaultDisablePublicShare,
};

interface PoemDetailProps {
  poemId: Id<'poems'>;
  shareSlug?: string;
  dependencies?: PoemDetailDependencies;
}

export function PoemDetail({
  poemId,
  shareSlug,
  dependencies = defaultPoemDetailDependencies,
}: PoemDetailProps) {
  const {
    guestToken: token,
    isLoading: authLoading,
    authError,
    retryAuth,
  } = dependencies.useUser();
  const guestToken = token || undefined;
  const PoemDisplayComponent = dependencies.PoemDisplayComponent;

  // Private reads wait for resolved identity; public sharing stays independent.
  const poemDetail = dependencies.usePoemDetail(
    poemId,
    guestToken,
    !authLoading && !authError
  );
  const publicPoem = dependencies.usePublicPoem(poemId, shareSlug);
  const shareStatus = dependencies.useShareStatus(shareSlug);
  const pendingShareExpiresAt =
    shareStatus?.state === 'pending' ? shareStatus.expiresAt : undefined;
  const pendingShareKey =
    shareSlug && pendingShareExpiresAt !== undefined
      ? `${shareSlug}:${pendingShareExpiresAt}`
      : null;
  const [expiredShareKey, setExpiredShareKey] = useState<string | null>(null);
  useEffect(() => {
    if (pendingShareKey === null || pendingShareExpiresAt === undefined) return;
    const remaining = Math.max(0, pendingShareExpiresAt - Date.now());
    const timer = setTimeout(
      () => setExpiredShareKey(pendingShareKey),
      remaining
    );
    return () => clearTimeout(timer);
  }, [pendingShareKey, pendingShareExpiresAt]);
  const sharePendingExpired =
    pendingShareKey !== null && expiredShareKey === pendingShareKey;

  // Use authenticated data if available, else public
  const privatePoem = authLoading || authError ? undefined : poemDetail;
  const data = privatePoem || publicPoem;
  const isParticipant = !!privatePoem;
  const isLoading =
    !data &&
    (authLoading ||
      (!authError && poemDetail === undefined) ||
      publicPoem === undefined);

  const isFavorited = dependencies.useIsFavorited(
    poemId,
    guestToken,
    isParticipant
  );
  const toggleFavorite = dependencies.useToggleFavorite();
  const disablePublicPoemShare = dependencies.useDisablePublicShare();

  if (
    !data &&
    shareSlug &&
    shareStatus?.state === 'pending' &&
    !sharePendingExpired
  ) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
        <p role="status" className="text-sm text-[var(--color-text-muted)]">
          Preparing this shared poem…
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)] flex items-center justify-center p-6">
        <div role="status" className="text-[var(--color-text-muted)]">
          Loading...
        </div>
      </div>
    );
  }

  if (!data && authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-left">
          <h1 className="font-sans font-bold text-3xl text-[var(--color-text-primary)]">
            Poem not found
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            This poem is private or unavailable.
          </p>
          <p className="text-[var(--color-text-secondary)]">
            Shared poem links only work after a participant makes the poem
            public.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
          >
            Return to Linejam
          </Link>
        </div>
      </div>
    );
  }

  const { poem, lines } = data;

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite({ poemId, guestToken });
      playSound('success');
    } catch (cause) {
      playSound('error');
      throw cause;
    }
  };

  // Transform lines to PoemLine format with author info
  const poemLines: PoemLine[] = lines.map((line) => ({
    text: line.text,
    authorName: line.authorName,
    authorStableId: line.authorKey,
  }));

  // Collect all stable IDs for consistent color assignment
  const allStableIds = lines
    .map((l) => l.authorKey)
    .filter((id): id is string => !!id);

  // Calculate unique poets
  const uniquePoets = new Set(lines.map((l) => l.authorName)).size;

  return (
    <PoemDisplayComponent
      poemId={poemId}
      guestToken={guestToken}
      lines={poemLines}
      variant="archive"
      alreadyRevealed
      allStableIds={allStableIds}
      metadata={{
        createdAt: poem.createdAt,
        firstLine: lines[0]?.text ?? '',
        isParticipant,
        isFavorited: isFavorited ?? false,
        isPublic: privatePoem?.poem.publicShareEnabled === true,
        onToggleFavorite: handleToggleFavorite,
        onRevokeShare: async () => {
          await disablePublicPoemShare({
            poemId,
            guestToken,
          });
        },
        backHref: isParticipant ? '/me/poems' : '/',
        backLabel: isParticipant ? 'Archive' : 'Linejam',
        uniquePoets,
      }}
    />
  );
}
