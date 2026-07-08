/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { renderSiteChangelogHtml } from '@/scripts/releases/site-changelog';
import type { ReleaseWithNotes } from '@/lib/releases/types';

describe('renderSiteChangelogHtml', () => {
  it('renders marketing changelog sections from generated release content', () => {
    const releases: ReleaseWithNotes[] = [
      {
        version: '1.2.0',
        date: '2026-07-08',
        productNotes:
          'Players can share the reveal.\n\nHosts get faster setup.',
        changes: [
          {
            type: 'feat',
            description: 'share reveal links',
            breaking: false,
            pr: 321,
          },
        ],
      },
      {
        version: 'v1.1.0',
        date: '2026-07-07',
        productNotes: '',
        changes: [
          {
            type: 'fix',
            scope: 'rooms',
            description: 'escape <room> names & keep joins safe',
            breaking: false,
            commit: 'abc1234',
          },
        ],
      },
      {
        version: '1.0.0',
        date: '2026-07-06',
        productNotes: '',
        changes: [
          {
            type: 'chore',
            description: 'update release internals',
            breaking: false,
          },
        ],
      },
    ];

    const html = renderSiteChangelogHtml(releases);

    expect(html).toContain('<title>Linejam release notes</title>');
    expect(html).toContain('2026-07-08 - v1.2.0');
    expect(html).toContain('<h2>Version 1.2.0</h2>');
    expect(html).toContain('<li>Players can share the reveal.</li>');
    expect(html).toContain('<li>Hosts get faster setup.</li>');
    expect(html).toContain('Evidence: PR #321.');
    expect(html).toContain('2026-07-07 - v1.1.0');
    expect(html).toContain(
      '(rooms) escape &lt;room&gt; names &amp; keep joins safe'
    );
    expect(html).toContain('Evidence: commit abc1234.');
    expect(html).toContain('2026-07-06 - v1.0.0');
    expect(html).toContain('Evidence: CHANGELOG.md.');
  });
});
