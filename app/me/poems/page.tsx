'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
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
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-24">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-[var(--color-border)] pb-8">
          <div>
            <h1 className="text-5xl md:text-6xl font-[var(--font-display)] leading-tight">
              Personal
              <br />
              Archive
            </h1>
          </div>
          <Link
            href="/"
            className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-2"
          >
            ← Return Home
          </Link>
        </div>

        {/* Favorites Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
              Marked Works
            </h2>
            <div className="h-px bg-[var(--color-border-subtle)] flex-1" />
          </div>

          {favorites && favorites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {favorites.map((poem) => (
                <Link
                  key={poem._id}
                  href={`/poem/${poem._id}`}
                  className="group"
                >
                  <div className="h-full bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)] group-hover:shadow-[var(--shadow-md)] group-hover:-translate-y-1 transition-all duration-300 flex flex-col">
                    <div className="flex-1 mb-6">
                      <p className="text-xl font-[var(--font-display)] italic leading-relaxed text-[var(--color-text-primary)]">
                        &ldquo;{poem.preview}...&rdquo;
                      </p>
                    </div>
                    <div className="flex justify-between items-end pt-4 border-t border-[var(--color-border-subtle)]">
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">
                        {new Date(poem.favoritedAt).toLocaleDateString()}
                      </span>
                      <span className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                        Read →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)] italic pl-4 border-l-2 border-[var(--color-border-subtle)]">
              No marked works yet.
            </p>
          )}
        </section>

        {/* Past Games Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
              Session History
            </h2>
            <div className="h-px bg-[var(--color-border-subtle)] flex-1" />
          </div>

          {poems && poems.length > 0 ? (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {poems.map((poem) => (
                <Link
                  key={poem._id}
                  href={`/poem/${poem._id}`}
                  className="group block"
                >
                  <div className="py-6 flex items-center justify-between hover:bg-[var(--color-surface)] px-4 -mx-4 transition-colors rounded-sm">
                    <div className="space-y-1">
                      <span className="text-xs font-mono text-[var(--color-text-muted)] block">
                        {new Date(
                          poem.roomDate || poem.createdAt
                        ).toLocaleDateString()}
                      </span>
                      <p className="text-lg font-[var(--font-display)] text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                        &ldquo;{poem.preview}...&rdquo;
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]">
                      Open
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)] italic pl-4 border-l-2 border-[var(--color-border-subtle)]">
              No sessions recorded.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
