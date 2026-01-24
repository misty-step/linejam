'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Release {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface GroupedReleases {
  [minorVersion: string]: Release[];
}

function parseVersion(
  tag: string
): { major: number; minor: number; patch: number } | null {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function getMinorVersion(tag: string): string {
  const version = parseVersion(tag);
  if (!version) return 'Other';
  return `${version.major}.${version.minor}`;
}

function groupReleasesByMinor(releases: Release[]): GroupedReleases {
  const groups: GroupedReleases = {};

  for (const release of releases) {
    const minor = getMinorVersion(release.tag_name);
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

function extractUserFriendlyNotes(body: string): string {
  // If body contains our marker, extract only the user-friendly part
  if (body.includes('<!-- synthesized -->')) {
    const detailsStart = body.indexOf('<details>');
    if (detailsStart > 0) {
      return body.slice(0, detailsStart).trim();
    }
  }
  return body;
}

export default function ChangelogPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch(
          'https://api.github.com/repos/phaedrus/linejam/releases?per_page=50',
          {
            headers: {
              Accept: 'application/vnd.github+json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch releases');
        }

        const data = await response.json();
        setReleases(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReleases();
  }, []);

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
      <main className="max-w-3xl mx-auto p-6 md:p-12 lg:p-16 w-full">
        <div className="space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <Link
              href="/"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              &larr; Back to Linejam
            </Link>
            <h1 className="text-4xl md:text-5xl font-[var(--font-display)] font-bold text-[var(--color-text-primary)]">
              Changelog
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)] font-[var(--font-sans)]">
              New features, improvements, and fixes.
            </p>
            <a
              href="/changelog.xml"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44zm0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
              </svg>
              RSS Feed
            </a>
          </div>

          {/* Content */}
          {loading && (
            <div className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
              Loading releases...
            </div>
          )}

          {error && (
            <div className="text-[var(--color-error)] font-[var(--font-sans)]">
              Error loading changelog: {error}
            </div>
          )}

          {!loading && !error && releases.length === 0 && (
            <div className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
              No releases yet. Check back soon!
            </div>
          )}

          {!loading && !error && releases.length > 0 && (
            <div className="space-y-16">
              {sortedMinorVersions.map((minorVersion) => (
                <section key={minorVersion} className="space-y-8">
                  <h2 className="text-2xl font-[var(--font-display)] font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">
                    Version {minorVersion}
                  </h2>

                  <div className="space-y-8">
                    {grouped[minorVersion].map((release) => (
                      <article key={release.id} className="space-y-3">
                        <header className="flex items-baseline gap-3 flex-wrap">
                          <h3 className="text-lg font-[var(--font-sans)] font-medium text-[var(--color-text-primary)]">
                            {release.tag_name}
                          </h3>
                          <time className="text-sm text-[var(--color-text-secondary)]">
                            {formatDate(release.published_at)}
                          </time>
                          <a
                            href={release.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-accent)] hover:underline"
                          >
                            View on GitHub
                          </a>
                        </header>

                        <div
                          className="prose prose-sm max-w-none text-[var(--color-text-secondary)] font-[var(--font-sans)]
                            [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-[var(--color-text-primary)]
                            [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--color-text-primary)]
                            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[var(--color-text-primary)]
                            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                            [&_li]:text-[var(--color-text-secondary)]
                            [&_a]:text-[var(--color-accent)] [&_a]:hover:underline
                            [&_code]:bg-[var(--color-surface)] [&_code]:px-1 [&_code]:rounded"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(
                              marked.parse(
                                extractUserFriendlyNotes(release.body || '')
                              ) as string
                            ),
                          }}
                        />
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
