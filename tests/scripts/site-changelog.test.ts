/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { renderSiteChangelogHtml } from '@/scripts/releases/site-changelog';
import { renderReleaseFeed } from '@/lib/releases/feed';
import type { ReleaseCatalog } from '@/lib/releases/types';

const catalog: ReleaseCatalog = {
  currentVersion: '0.27.0',
  diagnostics: [],
  releases: [
    {
      version: '0.27.0',
      date: '2026-08-01',
      productNotes:
        'Read <poems> & share deliberately.\n\n<img src=x onerror="alert(1)">',
      notesStatus: 'landmark',
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
      version: '1.15.1',
      date: '2026-07-04',
      productNotes: '',
      notesStatus: 'missing',
      changes: [
        {
          type: 'fix',
          scope: 'rooms',
          description: 'escape <room> names & keep joins safe',
          breaking: false,
        },
      ],
    },
  ],
};

describe('release projections', () => {
  it('escapes public and technical text and exposes stable release anchors', () => {
    // Inspect generated markup without loading the page's linked stylesheets.
    const template = document.createElement('template');
    template.innerHTML = renderSiteChangelogHtml(catalog);
    const current = template.content.getElementById('v0.27.0');
    const older = template.content.getElementById('v1.15.1');
    expect(current?.textContent).toContain(
      catalog.releases[0].productNotes.split('\n\n')[0]
    );
    expect(current?.querySelector('img')).toBeNull();
    expect(older?.querySelector('details')?.textContent).toContain(
      'escape <room> names & keep joins safe'
    );
    expect(older?.querySelector('room')).toBeNull();
    expect(older?.querySelector('details')?.open).toBe(false);
  });

  it('produces parseable RSS with matching deep links and no nested CDATA corruption', () => {
    const document = new DOMParser().parseFromString(
      renderReleaseFeed(catalog),
      'application/xml'
    );
    expect(document.querySelector('parsererror')).toBeNull();
    const items = Array.from(document.querySelectorAll('item'));
    expect(
      items.map((item) => item.querySelector('guid')?.textContent)
    ).toEqual(['v0.27.0', 'v1.15.1']);
    expect(items[0].querySelector('description')?.textContent).toBe(
      catalog.releases[0].productNotes
    );
    expect(items[0].querySelector('link')?.textContent).toBe(
      'https://linejam.app/releases#v0.27.0'
    );
    expect(items[1].querySelector('description')?.textContent).not.toContain(
      'escape <room>'
    );
  });
});
