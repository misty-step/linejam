import Link from 'next/link';
import { loadAllReleases } from '@/lib/releases/loader';
import type { ReleaseWithNotes, ChangelogEntry } from '@/lib/releases/types';
import { TYPE_LABELS } from '@/lib/releases/types';

export const dynamic = 'force-static';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
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

function TechnicalDetails({ changes }: { changes: ChangelogEntry[] }) {
  const grouped = groupChangesByType(changes);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]">
        Technical details ({changes.length} changes)
      </summary>

      <div className="mt-8 space-y-8">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              {TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type}
            </h4>
            <ul className="space-y-3 border-l-2 border-[var(--color-border)] pl-6">
              {items.map((change, i) => (
                <li
                  key={i}
                  className="text-sm leading-relaxed text-[var(--color-text-secondary)]"
                >
                  {change.scope && (
                    <span className="font-medium text-[var(--color-text-primary)]">
                      ({change.scope})
                    </span>
                  )}{' '}
                  {change.description}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function ReleaseCard({ release }: { release: ReleaseWithNotes }) {
  return (
    <article className="pb-24">
      {/* Version header with rule */}
      <header className="mb-12 border-b border-[var(--color-border)] pb-6">
        <h2
          className="font-[var(--font-display)] text-4xl text-[var(--color-text-primary)]"
          style={{ fontWeight: 400, letterSpacing: '-0.01em' }}
        >
          Version {release.version.replace(/^0\./, '0.')}
        </h2>
      </header>

      {/* Version + date inline */}
      <div className="mb-8 flex items-baseline gap-4">
        <span className="font-[var(--font-mono)] text-sm text-[var(--color-text-primary)]">
          v{release.version}
        </span>
        <time className="text-sm text-[var(--color-text-muted)]">
          {formatDate(release.date)}
        </time>
      </div>

      {/* Editorial prose - generous line height and paragraph spacing */}
      {release.productNotes && (
        <div className="mb-16 max-w-xl space-y-6">
          {release.productNotes.split('\n\n').map((paragraph, i) => (
            <p
              key={i}
              className="font-[var(--font-sans)] text-base leading-[1.8] text-[var(--color-text-secondary)]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {/* Technical details - collapsed by default */}
      <TechnicalDetails changes={release.changes} />
    </article>
  );
}

export default function ReleasesPage() {
  const releases = loadAllReleases();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <main className="mx-auto max-w-2xl px-6 py-20 md:py-32">
        {/* Back link - isolated with generous spacing */}
        <Link
          href="/"
          className="mb-16 inline-block text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          &larr; Back to Linejam
        </Link>

        {/* Page title - massive breathing room */}
        <header className="mb-24">
          <h1
            className="font-[var(--font-display)] text-6xl text-[var(--color-text-primary)] md:text-7xl"
            style={{ fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            Releases
          </h1>

          <p className="mt-6 font-[var(--font-sans)] text-lg text-[var(--color-text-muted)]">
            What&apos;s new in Linejam
          </p>

          <a
            href="/releases.xml"
            className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-hover)]"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44zm0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
            </svg>
            RSS Feed
          </a>
        </header>

        {/* Releases */}
        {releases.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">
            No releases yet. Check back soon!
          </p>
        ) : (
          <div>
            {releases.map((release) => (
              <ReleaseCard key={release.version} release={release} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
