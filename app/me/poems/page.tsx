'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@/lib/auth';
import { useAccountState } from '@/lib/account';
import { AuthErrorState } from '@/components/AuthErrorState';
import {
  PoemCard,
  PoemCardSkeleton,
  ArchiveStats,
  ArchiveStatsSkeleton,
  EmptyArchive,
  ArchiveInfoStrip,
} from '@/components/archive';

export default function ArchivePage() {
  const {
    guestToken,
    isLoading: authLoading,
    authError,
    retryAuth,
    isAuthenticated,
  } = useUser();
  const account = useAccountState();

  const archiveData = useQuery(
    api.archive.getArchiveData,
    authLoading || authError ? 'skip' : { guestToken: guestToken || undefined }
  );

  const isLoading = authLoading || archiveData === undefined;
  const poems = archiveData?.poems ?? [];
  const stats = archiveData?.stats ?? null;

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-sans font-bold leading-tight text-[var(--color-text-primary)]">
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

          {!isLoading && (
            <ArchiveInfoStrip
              isAuthenticated={isAuthenticated}
              accountsAvailable={account.kind === 'clerk'}
            />
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
            // Saved poems
            <section>
              {/* Gallery Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Featured Card (spans 2 cols on larger screens) */}
                {featuredPoem && (
                  <PoemCard
                    poem={featuredPoem}
                    guestToken={guestToken}
                    variant="featured"
                  />
                )}

                {/* Remaining Cards */}
                {remainingPoems.map((poem) => (
                  <PoemCard
                    key={poem._id}
                    poem={poem}
                    guestToken={guestToken}
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
