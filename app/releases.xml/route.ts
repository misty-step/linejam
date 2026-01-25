import { siteConfig } from '@/lib/config';
import { loadAllReleases } from '@/lib/releases/loader';

export const dynamic = 'force-static';

export async function GET() {
  const releases = loadAllReleases();

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const items = releases
    .map(
      (release) => `
    <item>
      <title>v${escapeXml(release.version)}</title>
      <link>${siteConfig.url}/releases#v${escapeXml(release.version)}</link>
      <guid isPermaLink="false">${escapeXml(release.version)}</guid>
      <pubDate>${new Date(release.date).toUTCString()}</pubDate>
      <description>${escapeXml(release.productNotes || `Release ${release.version}`)}</description>
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.title} Releases</title>
    <link>${siteConfig.url}/releases</link>
    <description>What's new in ${siteConfig.title}.</description>
    <language>en-us</language>
    <atom:link href="${siteConfig.url}/releases.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
