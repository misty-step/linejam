'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useParams } from 'next/navigation';
import { useUser } from '../../../lib/auth';
import { Label } from '../../../components/ui/Label';
import Link from 'next/link';
import { Id } from '../../../convex/_generated/dataModel';

export default function PoemDetailPage() {
  const params = useParams();
  const poemId = params.id as Id<'poems'>;
  const { guestToken } = useUser();
  const poemDetail = useQuery(api.poems.getPoemDetail, {
    poemId,
    guestToken: guestToken || undefined,
  });
  const isFavorited = useQuery(api.favorites.isFavorited, {
    poemId,
    guestToken: guestToken || undefined,
  });
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  if (!poemDetail) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">
          Loading...
        </div>
      </div>
    );
  }

  const { poem, lines } = poemDetail;

  const handleToggleFavorite = async () => {
    await toggleFavorite({ poemId, guestToken: guestToken || undefined });
  };

  // Calculate unique poets
  const uniquePoets = new Set(lines.map((l) => l.authorName)).size;

  // Format date
  const date = new Date(poem.createdAt);
  const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-12 px-6 md:px-12">
      <div className="max-w-3xl mx-auto space-y-16">
        {/* Header Navigation */}
        <div className="flex justify-between items-center">
          <Link
            href="/me/poems"
            className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            ← Home
          </Link>
          <button
            onClick={handleToggleFavorite}
            className={`transition-colors ${
              isFavorited
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
            }`}
            aria-label="Toggle favorite"
          >
            <svg
              className="w-6 h-6"
              fill={isFavorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Metadata Header */}
        <div className="space-y-6">
          <div className="border-t-2 border-b-2 border-[var(--color-primary)] py-4 space-y-2">
            <h1 className="text-sm font-mono uppercase tracking-[0.3em] text-[var(--color-primary)] font-medium">
              Poem No. {poem.indexInRoom + 1}
            </h1>
            <Label>Created {formattedDate}</Label>
          </div>
        </div>

        {/* Poem Content */}
        <div className="space-y-8 py-8">
          {lines.map((line, index) => (
            <div
              key={line._id}
              className="flex items-baseline justify-between gap-8 opacity-0 animate-type"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <p className="text-2xl md:text-3xl lg:text-4xl font-[var(--font-display)] leading-tight flex-1">
                {line.text}
              </p>
              <span className="text-xs font-[var(--font-sans)] text-[var(--color-text-muted)] whitespace-nowrap">
                — {line.authorName}
              </span>
            </div>
          ))}
        </div>

        {/* Footer Stats */}
        <div className="border-t border-[var(--color-border)] pt-6">
          <Label>
            {lines.length} Line{lines.length !== 1 ? 's' : ''} · {uniquePoets}{' '}
            Poet{uniquePoets !== 1 ? 's' : ''}
          </Label>
        </div>
      </div>
    </div>
  );
}
