/**
 * Personal Archive Page
 *
 * Manuscript Gallery layout - poems as artifacts in a personal collection.
 *
 * Design Philosophy (Stripe-inspired):
 * - Information density with clear hierarchy
 * - Purposeful animation (staggered entrance)
 * - Progressive disclosure (hover reveals)
 * - Semantic color (author dots)
 *
 * Architecture (Ousterhout):
 * - Single enriched query (no N+1)
 * - Deep components (PoemCard handles everything)
 * - Simple page composition
 */

'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@/lib/auth';
import Link from 'next/link';
import {
  PoemCard,
  PoemCardSkeleton,
  ArchiveStats,
  ArchiveStatsSkeleton,
  EmptyArchive,
} from '@/components/archive';

export default function ArchivePage() {
  const { guestToken, isLoading: authLoading } = useUser();

  const archiveData = useQuery(api.archive.getArchiveData, {
    guestToken: guestToken || undefined,
  });

  const isLoading = authLoading || archiveData === undefined;
  const poems = archiveData?.poems ?? [];
  const stats = archiveData?.stats ?? null;

  // Separate featured poem (most recent favorited, or just most recent)
  const featuredPoem = poems.find((p) => p.isFavorited) || poems[0];
  const remainingPoems = poems.filter((p) => p._id !== featuredPoem?._id);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16 lg:py-24">
        {/* Header */}
        <header className="mb-12 md:mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
            {/* Title Block */}
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-[var(--font-display)] leading-[0.9] tracking-tight text-[var(--color-text-primary)]">
                Personal
                <br />
                Archive
              </h1>
            </div>

            {/* Navigation */}
            <Link
              href="/"
              className="self-start sm:self-end text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <span className="inline-block transition-transform group-hover:-translate-x-1">
                &larr;
              </span>{' '}
              Return Home
            </Link>
          </div>

          {/* Stats Row */}
          {isLoading ? (
            <ArchiveStatsSkeleton />
          ) : stats && stats.totalPoems > 0 ? (
            <ArchiveStats stats={stats} />
          ) : null}
        </header>

        {/* Main Content */}
        <main>
          {isLoading ? (
            // Loading State
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <PoemCardSkeleton key={i} />
              ))}
            </div>
          ) : poems.length === 0 ? (
            // Empty State
            <EmptyArchive />
          ) : (
            // Manuscript Gallery
            <section>
              {/* Section Label */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                  Collection
                </span>
                <div className="h-px bg-[var(--color-border-subtle)] flex-1" />
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  {poems.length} {poems.length === 1 ? 'poem' : 'poems'}
                </span>
              </div>

              {/* Gallery Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Featured Card (spans 2 cols on larger screens) */}
                {featuredPoem && (
                  <PoemCard
                    poem={featuredPoem}
                    guestToken={guestToken}
                    variant="featured"
                    animationDelay={0}
                  />
                )}

                {/* Remaining Cards */}
                {remainingPoems.map((poem, index) => (
                  <PoemCard
                    key={poem._id}
                    poem={poem}
                    guestToken={guestToken}
                    animationDelay={(index + 1) * 50}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        {poems.length > 0 && (
          <footer className="mt-16 md:mt-24 pt-8 border-t border-[var(--color-border-subtle)]">
            <p className="text-sm text-[var(--color-text-muted)] text-center font-mono">
              Tap any poem to read the full verse
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
