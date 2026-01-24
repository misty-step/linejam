import { siteConfig } from '@/lib/config';

interface Release {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

export async function GET() {
  let releases: Release[] = [];

  try {
    const response = await fetch(
      'https://api.github.com/repos/phaedrus/linejam/releases?per_page=20',
      {
        headers: {
          Accept: 'application/vnd.github+json',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (response.ok) {
      releases = await response.json();
    }
  } catch {
    // Return empty feed on error
  }

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const extractSummary = (body: string): string => {
    if (!body) return '';
    // If synthesized, take only the user-friendly part
    if (body.includes('<!-- synthesized -->')) {
      const detailsStart = body.indexOf('<details>');
      if (detailsStart > 0) {
        return body.slice(0, detailsStart).trim();
      }
    }
    // Truncate to first 500 chars
    return body.slice(0, 500) + (body.length > 500 ? '...' : '');
  };

  const items = releases
    .map(
      (release) => `
    <item>
      <title>${escapeXml(release.tag_name)}${release.name ? ` - ${escapeXml(release.name)}` : ''}</title>
      <link>${escapeXml(release.html_url)}</link>
      <guid isPermaLink="true">${escapeXml(release.html_url)}</guid>
      <pubDate>${new Date(release.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(extractSummary(release.body || ''))}</description>
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.title} Changelog</title>
    <link>${siteConfig.url}/changelog</link>
    <description>New features, improvements, and fixes for ${siteConfig.title}.</description>
    <language>en-us</language>
    <atom:link href="${siteConfig.url}/changelog.xml" rel="self" type="application/rss+xml"/>
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
