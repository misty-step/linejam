'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/** Only explicitly published poems may appear outside a participant's archive. */
export function AuthShowcase() {
  const recentPoems = useQuery(api.archive.getRecentPublicPoems, { limit: 5 });
  const showcasePoem = recentPoems?.[0] ?? null;

  return (
    <aside className="flex h-full flex-col justify-center p-8 lg:p-16">
      {showcasePoem ? (
        <figure className="max-w-lg rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8">
          <blockquote className="space-y-2 break-words text-left font-sans text-xl leading-relaxed text-[var(--color-text-primary)]">
            {showcasePoem.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </blockquote>
          <figcaption className="mt-6 text-sm text-[var(--color-text-secondary)]">
            A public poem by {showcasePoem.poetCount}{' '}
            {showcasePoem.poetCount === 1 ? 'poet' : 'poets'}
          </figcaption>
        </figure>
      ) : (
        <div className="max-w-sm space-y-4">
          <p className="text-3xl font-display leading-snug text-[var(--color-text-primary)]">
            A little room for words.
          </p>
          <p className="text-lg leading-relaxed text-[var(--color-text-secondary)]">
            Write a line. Pass it on.
          </p>
        </div>
      )}
    </aside>
  );
}
