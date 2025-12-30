/**
 * EmptyArchive: Delightful empty state
 *
 * Shown when user has no poems yet.
 * Design: Inviting, not sad. Encourages first game.
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { PoemShape } from './PoemShape';

interface EmptyArchiveProps {
  /** Optional variant for different contexts */
  variant?: 'default' | 'filtered';
}

/**
 * EmptyArchive component
 *
 * Features:
 * - Ghosted poem shape (shows what's to come)
 * - Warm, inviting copy
 * - Clear CTA to start playing
 */
export function EmptyArchive({ variant = 'default' }: EmptyArchiveProps) {
  if (variant === 'filtered') {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-[var(--color-text-muted)] font-[var(--font-display)] italic">
          No poems match your search
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <div className="py-16 md:py-24 flex flex-col items-center text-center">
      {/* Ghosted poem shape - preview of what's to come */}
      <div className="mb-8 opacity-20">
        <PoemShape
          wordCounts={[1, 2, 3, 4, 5, 4, 3, 2, 1]}
          size="lg"
        />
      </div>

      {/* Inviting headline */}
      <h2 className="text-2xl md:text-3xl font-[var(--font-display)] text-[var(--color-text-primary)] mb-4">
        Your archive awaits
      </h2>

      {/* Warm description */}
      <p className="text-[var(--color-text-muted)] max-w-md mb-8 leading-relaxed">
        Every poem you help create will appear here.
        <br />
        Start a game and write your first lines.
      </p>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/host">
          <Button size="lg" className="min-w-[160px]">
            Start a Game
          </Button>
        </Link>
        <Link href="/join">
          <Button variant="secondary" size="lg" className="min-w-[160px]">
            Join a Room
          </Button>
        </Link>
      </div>

      {/* Decorative element */}
      <div className="mt-16 flex items-center gap-3 text-[var(--color-text-muted)]">
        <div className="w-8 h-px bg-[var(--color-border-subtle)]" />
        <span className="text-xs font-mono uppercase tracking-widest">
          Begin your collection
        </span>
        <div className="w-8 h-px bg-[var(--color-border-subtle)]" />
      </div>
    </div>
  );
}
