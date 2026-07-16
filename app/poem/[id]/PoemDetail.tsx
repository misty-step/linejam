'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import { Id } from '../../../convex/_generated/dataModel';
import { PoemDisplay, PoemLine } from '../../../components/PoemDisplay';

export function PoemDetail({
  poemId,
  shareSlug,
}: {
  poemId: Id<'poems'>;
  shareSlug?: string;
}) {
  const { guestToken } = useUser();

  // Try authenticated query first (includes favorite capability)
  const poemDetail = useQuery(api.poems.getPoemDetail, {
    poemId,
    guestToken: guestToken || undefined,
  });
  // Fallback to public query for outsiders
  const publicPoem = useQuery(api.poems.getPublicPoemFull, {
    poemId,
    shareSlug,
  });
  const shareStatus = useQuery(
    api.poems.getPublicPoemShareStatus,
    shareSlug ? { shareSlug } : 'skip'
  );
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

  const isFavorited = useQuery(
    api.favorites.isFavorited,
    isParticipant ? { poemId, guestToken: guestToken || undefined } : 'skip'
  );
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);
  const disablePublicPoemShare = useMutation(api.shares.disablePublicPoemShare);

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
    await toggleFavorite({ poemId, guestToken: guestToken || undefined });
  };

  // Transform lines to PoemLine format with author info
  const poemLines: PoemLine[] = lines.map((line) => ({
    text: line.text,
    authorName: line.authorName,
    authorStableId: line.authorKey,
    isBot: line.isBot,
  }));

  // Collect all stable IDs for consistent color assignment
  const allStableIds = lines
    .map((l) => l.authorKey)
    .filter((id): id is string => !!id);

  // Calculate unique poets
  const uniquePoets = new Set(lines.map((l) => l.authorName)).size;

  return (
    <PoemDisplay
      poemId={poemId}
      guestToken={guestToken || undefined}
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
            guestToken: guestToken || undefined,
          });
        },
        backHref: isParticipant ? '/me/poems' : '/',
        backLabel: isParticipant ? '← Archive' : '← Linejam',
        uniquePoets,
      }}
    />
  );
}
