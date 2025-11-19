'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import Link from 'next/link';

export default function MyPoemsPage() {
  const { guestId, isLoading } = useUser();

  const poems = useQuery(api.poems.getMyPoems, {
    guestId: guestId || undefined,
  });

  const favorites = useQuery(api.favorites.getMyFavorites, {
    guestId: guestId || undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6">
      <div className="max-w-4xl mx-auto space-y-10 animate-stagger">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl">My Collection</h1>
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          >
            Home
          </Link>
        </div>

        {/* Favorites Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Favorites
          </h2>
          {favorites && favorites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((poem) => (
                <Link key={poem._id} href={`/poem/${poem._id}`}>
                  <Card className="h-full hover:shadow-[var(--shadow-md)] transition-shadow duration-[var(--duration-base)] cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-sm text-[var(--color-text-muted)]">
                        {new Date(poem.favoritedAt).toLocaleDateString()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[var(--color-text-primary)] italic line-clamp-3 font-[var(--font-display)]">
                        &ldquo;{poem.preview}...&rdquo;
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)]">No favorites yet.</p>
          )}
        </section>

        {/* Past Games Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Past Games
          </h2>
          {poems && poems.length > 0 ? (
            <div className="space-y-2">
              {poems.map((poem) => (
                <Link key={poem._id} href={`/poem/${poem._id}`}>
                  <div className="block bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 rounded-[var(--radius-md)] hover:shadow-[var(--shadow-sm)] transition-shadow duration-[var(--duration-base)]">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        Game on{' '}
                        {new Date(
                          poem.roomDate || poem.createdAt
                        ).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        View Poem →
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1 truncate">
                      &ldquo;{poem.preview}...&rdquo;
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)]">
              No games played yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
