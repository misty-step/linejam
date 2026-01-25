import Link from 'next/link';
import { marked } from 'marked';
import { loadAllReleases } from '@/lib/releases/loader';
import type { ReleaseWithNotes } from '@/lib/releases/types';
import { TYPE_LABELS } from '@/lib/releases/types';

export const dynamic = 'force-static';

function parseVersion(
  version: string
): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function getMinorVersion(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) return 'Other';
  return `${parsed.major}.${parsed.minor}`;
}

interface GroupedReleases {
  [minorVersion: string]: ReleaseWithNotes[];
}

function groupReleasesByMinor(releases: ReleaseWithNotes[]): GroupedReleases {
  const groups: GroupedReleases = {};

  for (const release of releases) {
    const minor = getMinorVersion(release.version);
    if (!groups[minor]) {
      groups[minor] = [];
    }
    groups[minor].push(release);
  }

  return groups;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReleasesPage() {
  const releases = loadAllReleases();
  const grouped = groupReleasesByMinor(releases);

  const sortedMinorVersions = Object.keys(grouped).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    if (bMajor !== aMajor) return bMajor - aMajor;
    return bMinor - aMinor;
  });

  return (
    <div className="flex flex-col bg-[var(--color-background)]">
      <main className="mx-auto w-full max-w-3xl p-6 md:p-12 lg:p-16">
        <div className="space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <Link
              href="/"
              className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              &larr; Back to Linejam
            </Link>
            <h1 className="font-[var(--font-display)] text-4xl font-bold text-[var(--color-text-primary)] md:text-5xl">
              Releases
            </h1>
            <p className="font-[var(--font-sans)] text-lg text-[var(--color-text-secondary)]">
              What&apos;s new in Linejam
            </p>
            <a
              href="/releases.xml"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44zm0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
              </svg>
              RSS Feed
            </a>
          </div>

          {/* Content */}
          {releases.length === 0 && (
            <div className="font-[var(--font-sans)] text-[var(--color-text-secondary)]">
              No releases yet. Check back soon!
            </div>
          )}

          {releases.length > 0 && (
            <div className="space-y-16">
              {sortedMinorVersions.map((minorVersion) => (
                <section key={minorVersion} className="space-y-8">
                  <h2 className="border-b border-[var(--color-border)] pb-2 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text-primary)]">
                    Version {minorVersion}
                  </h2>

                  <div className="space-y-8">
                    {grouped[minorVersion].map((release) => (
                      <article key={release.version} className="space-y-4">
                        <header className="flex flex-wrap items-baseline gap-3">
                          <h3 className="font-[var(--font-sans)] text-lg font-medium text-[var(--color-text-primary)]">
                            v{release.version}
                          </h3>
                          <time className="text-sm text-[var(--color-text-secondary)]">
                            {formatDate(release.date)}
                          </time>
                        </header>

                        {/* Product notes (LLM-generated) */}
                        {release.productNotes && (
                          <div
                            className="prose prose-sm max-w-none font-[var(--font-sans)] text-[var(--color-text-secondary)] [&_a]:text-[var(--color-accent)] [&_a]:hover:underline [&_p]:mb-3"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(
                                release.productNotes
                              ) as string,
                            }}
                          />
                        )}

                        {/* Technical changes (collapsed by default) */}
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                            Technical details ({release.changes.length} changes)
                          </summary>
                          <div className="mt-3 space-y-2 border-l-2 border-[var(--color-border)] pl-4">
                            {Object.entries(
                              groupChangesByType(release.changes)
                            ).map(([type, changes]) => (
                              <div key={type}>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                  {TYPE_LABELS[
                                    type as keyof typeof TYPE_LABELS
                                  ] || type}
                                </h4>
                                <ul className="mt-1 space-y-1">
                                  {changes.map((change, i) => (
                                    <li
                                      key={i}
                                      className="text-sm text-[var(--color-text-secondary)]"
                                    >
                                      {change.scope && (
                                        <span className="font-medium">
                                          ({change.scope}){' '}
                                        </span>
                                      )}
                                      {change.description}
                                      {change.breaking && (
                                        <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">
                                          BREAKING
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </details>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function groupChangesByType(
  changes: ReleaseWithNotes['changes']
): Record<string, ReleaseWithNotes['changes']> {
  return changes.reduce(
    (acc, change) => {
      const type = change.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(change);
      return acc;
    },
    {} as Record<string, ReleaseWithNotes['changes']>
  );
}
