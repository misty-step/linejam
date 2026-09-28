import { NOTES_STATUS_LABELS, type ReleaseCatalog } from './types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Full replacement, not append/CDATA mutation; reruns are byte-identical. */
export function renderReleaseFeed(catalog: ReleaseCatalog): string {
  const siteUrl = 'https://linejam.app';
  const items = catalog.releases
    .map((release) => {
      let description =
        release.productNotes || NOTES_STATUS_LABELS[release.notesStatus];
      if (release.notesStatus === 'unavailable') {
        const technical = release.changes
          .map(
            ({ scope, description }) =>
              `- ${scope ? `(${scope}) ` : ''}${description}`
          )
          .join('\n');
        description = `${NOTES_STATUS_LABELS.unavailable}\n\nTechnical history:\n${technical}`;
      }
      return `    <item>
      <title>Linejam v${escapeXml(release.version)}</title>
      <link>${siteUrl}/releases#v${escapeXml(release.version)}</link>
      <guid isPermaLink="false">v${escapeXml(release.version)}</guid>
      <pubDate>${new Date(`${release.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
    })
    .join('\n');
  const latestDate = catalog.releases[0]?.date;
  const problems = catalog.diagnostics.some(
    (diagnostic) => diagnostic.severity === 'error'
  )
    ? ' Some release content is out of sync; see the releases page.'
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Linejam Releases</title>
    <link>${siteUrl}/releases</link>
    <description>${escapeXml(`What's new in Linejam.${problems}`)}</description>
    <language>en-us</language>
    <atom:link href="${siteUrl}/releases.xml" rel="self" type="application/rss+xml"/>
${latestDate ? `    <lastBuildDate>${new Date(`${latestDate}T00:00:00Z`).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
}
