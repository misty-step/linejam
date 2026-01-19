'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * AuthShowcase: Poem Preview for Auth Pages
 *
 * Displays a recent completed poem from the database as visual interest
 * on the auth screens. Falls back to a placeholder if no poems exist.
 *
 * Theme-aware: Uses CSS variables for all colors and typography.
 */
export function AuthShowcase() {
  // Query recent poems to showcase
  const recentPoems = useQuery(api.archive.getRecentPublicPoems, { limit: 5 });

  // Show the most recent quality poem (deterministic selection)
  const showcasePoem = recentPoems?.[0] ?? null;

  return (
    <div className="h-full flex flex-col justify-center p-6 md:p-12 lg:p-16">
      {/* Section Label */}
      <div className="mb-8 theme-vertical-text md:hidden">
        <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-[var(--font-sans)]">
          Recent Creation
        </span>
      </div>

      {/* Poem Display */}
      <div className="paper p-6 md:p-8 max-w-lg mx-auto md:mx-0">
        {showcasePoem ? (
          <>
            {/* Poem Lines */}
            <div className="space-y-2 mb-6">
              {showcasePoem.lines.map((line, i) => (
                <p
                  key={i}
                  className="text-lg md:text-xl font-[var(--font-display)] text-[var(--color-text-primary)] leading-relaxed"
                  style={{
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* Attribution */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <p className="text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
                by {showcasePoem.poetCount}{' '}
                {showcasePoem.poetCount === 1 ? 'poet' : 'poets'}
              </p>
            </div>
          </>
        ) : (
          // Placeholder when no poems available
          <>
            <div className="space-y-2 mb-6">
              <p className="text-lg md:text-xl font-[var(--font-display)] text-[var(--color-text-primary)] leading-relaxed italic">
                &ldquo;Words
              </p>
              <p className="text-lg md:text-xl font-[var(--font-display)] text-[var(--color-text-primary)] leading-relaxed italic">
                become poems
              </p>
              <p className="text-lg md:text-xl font-[var(--font-display)] text-[var(--color-text-primary)] leading-relaxed italic">
                when friends write together&rdquo;
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <p className="text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
                Start a game to create your first poem
              </p>
            </div>
          </>
        )}
      </div>

      {/* Desktop Vertical Label */}
      <div className="hidden md:block mt-8">
        <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-[var(--font-sans)]">
          Featured Poem
        </span>
      </div>
    </div>
  );
}
