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

  // Sort: favorites first, then by date descending within each group
  const sortedPoems = [...poems].sort((a, b) => {
    if (a.isFavorited && !b.isFavorited) return -1;
    if (!a.isFavorited && b.isFavorited) return 1;
    return b.createdAt - a.createdAt;
  });

  // Featured poem is always first (which will be most recent favorite, or most recent overall)
  const featuredPoem = sortedPoems[0];
  const remainingPoems = sortedPoems.slice(1);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16 lg:py-24">
        {/* Header */}
        <header className="mb-8 md:mb-12">
          {/* Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-[var(--font-display)] leading-[0.9] tracking-tight text-[var(--color-text-primary)]">
            Archive
          </h1>

          {/* Stats */}
          <div className="mt-6">
            {isLoading ? (
              <ArchiveStatsSkeleton />
            ) : stats && stats.totalPoems > 0 ? (
              <ArchiveStats stats={stats} />
            ) : null}
          </div>

          {/* Hint Text - sandwiched between hairlines */}
          {!isLoading && poems.length > 0 && (
            <div className="mt-8 py-4 border-y border-[var(--color-border-subtle)]">
              <p className="text-sm text-[var(--color-text-muted)] font-mono">
                Tap any poem to reveal the full verse
              </p>
            </div>
          )}
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
      </div>
    </div>
  );
}
