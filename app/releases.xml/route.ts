import { loadReleaseCatalog } from '@/lib/releases/loader';
import { renderReleaseFeed } from '@/lib/releases/feed';

export const dynamic = 'force-static';

export async function GET() {
  const rss = renderReleaseFeed(loadReleaseCatalog());

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
