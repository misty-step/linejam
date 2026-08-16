'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import type { Id } from '../../../convex/_generated/dataModel';
import { PoemDisplay, type PoemLine } from '../../../components/PoemDisplay';

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

function useDefaultGuestToken(): string | undefined {
  return useUser().guestToken || undefined;
}

function useDefaultPoemDetail(
  poemId: Id<'poems'>,
  guestToken?: string
): PoemDetailData | null | undefined {
  return useQuery(api.poems.getPoemDetail, { poemId, guestToken });
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
  useGuestToken: typeof useDefaultGuestToken;
  usePoemDetail: typeof useDefaultPoemDetail;
  usePublicPoem: typeof useDefaultPublicPoem;
  useShareStatus: typeof useDefaultShareStatus;
  useIsFavorited: typeof useDefaultIsFavorited;
  useToggleFavorite: typeof useDefaultToggleFavorite;
  useDisablePublicShare: typeof useDefaultDisablePublicShare;
  PoemDisplayComponent: typeof PoemDisplay;
}

const defaultPoemDetailDependencies: PoemDetailDependencies = {
  useGuestToken: useDefaultGuestToken,
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
  const guestToken = dependencies.useGuestToken();
  const PoemDisplayComponent = dependencies.PoemDisplayComponent;

  // Try authenticated query first (includes favorite capability)
  const poemDetail = dependencies.usePoemDetail(poemId, guestToken);
  // Fallback to public query for outsiders
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
  const data = poemDetail || publicPoem;
  const isParticipant = !!poemDetail;
  const isLoading =
    !data && (poemDetail === undefined || publicPoem === undefined);

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
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">
          Loading...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
            Poem not found
          </p>
          <h1 className="font-[var(--font-display)] text-4xl text-[var(--color-text-primary)]">
            This poem is private or unavailable.
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Shared poem links only work after a participant makes the poem
            public.
          </p>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-sm font-medium text-[var(--color-text-primary)] hover:shadow-md"
          >
            Return to Linejam
          </Link>
        </div>
      </div>
    );
  }

  const { poem, lines } = data;

  const handleToggleFavorite = async () => {
    await toggleFavorite({ poemId, guestToken });
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
        isPublic: poemDetail?.poem.publicShareEnabled === true,
        onToggleFavorite: handleToggleFavorite,
        onRevokeShare: async () => {
          await disablePublicPoemShare({
            poemId,
            guestToken,
          });
        },
        backHref: isParticipant ? '/me/poems' : '/',
        backLabel: isParticipant ? '← Archive' : '← Linejam',
        uniquePoets,
      }}
    />
  );
}
