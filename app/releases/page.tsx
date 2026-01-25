import Link from 'next/link';
import { loadAllReleases } from '@/lib/releases/loader';
import type { ReleaseWithNotes, ChangelogEntry } from '@/lib/releases/types';

export const dynamic = 'force-static';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function groupChangesByType(
  changes: ChangelogEntry[]
): Record<string, ChangelogEntry[]> {
  return changes.reduce(
    (acc, change) => {
      const type = change.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(change);
      return acc;
    },
    {} as Record<string, ChangelogEntry[]>
  );
}

function ChangesList({ changes }: { changes: ChangelogEntry[] }) {
  const grouped = groupChangesByType(changes);
  const feats = grouped.feat || [];
  const fixes = grouped.fix || [];
  const other = Object.entries(grouped)
    .filter(([type]) => type !== 'feat' && type !== 'fix')
    .flatMap(([, items]) => items);

  // Show top 3 features as numbered highlights
  const highlights = feats.slice(0, 3);
  const remaining = [...feats.slice(3), ...fixes, ...other];

  return (
    <div className="space-y-6">
      {/* Numbered feature highlights */}
      {highlights.length > 0 && (
        <div className="flex gap-8 pt-4">
          {highlights.map((change, i) => (
            <div key={i} className="flex-1">
              <span
                className="block font-[var(--font-display)] text-3xl text-[var(--color-primary)]"
                style={{ fontWeight: 400 }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="block pt-1 text-sm text-[var(--color-text-secondary)]">
                {change.scope && (
                  <span className="text-[var(--color-text-muted)]">
                    {change.scope}:{' '}
                  </span>
                )}
                {change.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Remaining changes as compact list */}
      {remaining.length > 0 && (
        <details className="group pt-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
            {remaining.length} more change{remaining.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-3 space-y-1 border-l border-[var(--color-border)] pl-4">
            {remaining.map((change, i) => (
              <li
                key={i}
                className="text-sm text-[var(--color-text-secondary)]"
              >
                {change.scope && (
                  <span className="text-[var(--color-text-muted)]">
                    [{change.scope}]{' '}
                  </span>
                )}
                {change.description}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReleaseCard({ release }: { release: ReleaseWithNotes }) {
  return (
    <article className="group relative flex gap-8">
      {/* Timeline dot */}
      <div className="relative flex flex-col items-center">
        <div className="h-3 w-3 rounded-full bg-[var(--color-primary)]" />
        <div className="w-px flex-1 bg-[var(--color-border)]" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-16">
        {/* Header */}
        <header className="flex items-baseline gap-4">
          <h3 className="font-[var(--font-sans)] text-lg font-medium text-[var(--color-text-primary)]">
            v{release.version}
          </h3>
          <time className="text-sm text-[var(--color-text-muted)]">
            {formatDate(release.date)}
          </time>
        </header>

        {/* Editorial prose */}
        {release.productNotes && (
          <div className="mt-4 max-w-xl space-y-4 font-[var(--font-sans)] text-[var(--color-text-secondary)]">
            {release.productNotes.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-base leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {/* Changes */}
        <ChangesList changes={release.changes} />
      </div>
    </article>
  );
}

export default function ReleasesPage() {
  const releases = loadAllReleases();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <main className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        {/* Header */}
        <header className="mb-16 space-y-4">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            &larr; Back to Linejam
          </Link>

          <h1
            className="font-[var(--font-display)] text-5xl text-[var(--color-text-primary)] md:text-6xl"
            style={{ fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            Releases
          </h1>

          <p className="font-[var(--font-display)] text-lg italic text-[var(--color-text-secondary)]">
            A chronicle of what&apos;s new
          </p>

          <a
            href="/releases.xml"
            className="inline-flex items-center gap-2 pt-2 text-sm text-[var(--color-primary)] hover:underline"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44zm0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
            </svg>
            RSS Feed
          </a>
        </header>

        {/* Releases timeline */}
        {releases.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">
            No releases yet. Check back soon!
          </p>
        ) : (
          <div className="relative">
            {releases.map((release) => (
              <ReleaseCard key={release.version} release={release} />
            ))}

            {/* Timeline end cap */}
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-[var(--color-border)]" />
              </div>
              <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
                The beginning
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
