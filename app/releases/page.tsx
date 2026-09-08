import Link from 'next/link';
import { loadAllReleases } from '@/lib/releases/loader';
import type {
  ReleaseWithNotes,
  ChangelogEntry,
  ChangeType,
} from '@/lib/releases/types';
import { TYPE_LABELS } from '@/lib/releases/types';

export const dynamic = 'force-static';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type GroupedChanges = {
  type: ChangeType;
  label: string;
  items: ChangelogEntry[];
};

function groupChangesByType(changes: ChangelogEntry[]): GroupedChanges[] {
  const map = new Map<ChangeType, ChangelogEntry[]>();
  for (const change of changes) {
    const existing = map.get(change.type);
    if (existing) {
      existing.push(change);
    } else {
      map.set(change.type, [change]);
    }
  }
  return Array.from(map.entries()).map(([type, items]) => ({
    type,
    label: TYPE_LABELS[type],
    items,
  }));
}

function TechnicalDetails({ changes }: { changes: ChangelogEntry[] }) {
  const grouped = groupChangesByType(changes);

  return (
    <details className="group">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
        Technical details ({changes.length} changes)
      </summary>

      <div className="mt-8 space-y-8">
        {grouped.map(({ type, label, items }) => (
          <div key={type}>
            <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
              {label}
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
    <article className="pb-12">
      <header className="mb-4">
        <h2 className="font-sans font-bold text-2xl text-[var(--color-text-primary)]">
          Version {release.version}
        </h2>
      </header>

      <div className="mb-6">
        <time
          dateTime={release.date}
          className="text-sm text-[var(--color-text-muted)]"
        >
          {formatDate(release.date)}
        </time>
      </div>

      {release.productNotes && (
        <div className="mb-6 max-w-xl space-y-4">
          {release.productNotes.split('\n\n').map((paragraph, i) => (
            <p
              key={i}
              className="font-sans text-base leading-relaxed text-[var(--color-text-secondary)]"
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
      <main className="mx-auto max-w-2xl px-5 py-8 md:py-12">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-11 items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
        >
          Back to Linejam
        </Link>

        <header className="mb-12">
          <h1 className="font-sans font-bold text-3xl text-[var(--color-text-primary)] md:text-4xl">
            Releases
          </h1>

          <p className="mt-3 font-sans text-lg text-[var(--color-text-secondary)]">
            What&apos;s new in Linejam
          </p>

          <a
            href="/releases.xml"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44zm0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
            </svg>
            RSS feed
          </a>
        </header>

        {/* Releases */}
        {releases.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No releases yet.</p>
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
