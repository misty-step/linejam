'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import { Id } from '../../../convex/_generated/dataModel';
import { PoemDisplay, PoemLine } from '../../../components/PoemDisplay';

export function PoemDetail({ poemId }: { poemId: Id<'poems'> }) {
  const { guestToken } = useUser();

  // Try authenticated query first (includes favorite capability)
  const poemDetail = useQuery(api.poems.getPoemDetail, {
    poemId,
    guestToken: guestToken || undefined,
  });
  // Fallback to public query for outsiders
  const publicPoem = useQuery(api.poems.getPublicPoemFull, { poemId });

  // Use authenticated data if available, else public
  const data = poemDetail || publicPoem;
  const isParticipant = !!poemDetail;

  const isFavorited = useQuery(
    api.favorites.isFavorited,
    isParticipant ? { poemId, guestToken: guestToken || undefined } : 'skip'
  );
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">
          Loading...
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
    authorStableId: line.authorStableId,
    isBot: line.isBot,
  }));

  // Collect all stable IDs for consistent color assignment
  const allStableIds = lines
    .map((l) => l.authorStableId)
    .filter((id): id is string => !!id);

  // Calculate unique poets
  const uniquePoets = new Set(lines.map((l) => l.authorName)).size;

  return (
    <PoemDisplay
      poemId={poemId}
      lines={poemLines}
      variant="archive"
      alreadyRevealed
      allStableIds={allStableIds}
      metadata={{
        createdAt: poem.createdAt,
        firstLine: lines[0]?.text ?? '',
        isParticipant,
        isFavorited: isFavorited ?? false,
        onToggleFavorite: handleToggleFavorite,
        backHref: isParticipant ? '/me/poems' : '/',
        backLabel: isParticipant ? '← Archive' : '← Linejam',
        uniquePoets,
      }}
    />
  );
}
