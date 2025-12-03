import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { fetchQuery } from 'convex/nextjs';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const preview = await fetchQuery(api.poems.getPublicPoemPreview, {
    poemId: id as Id<'poems'>,
  }).catch(() => null);

  if (!preview) {
    return {
      title: 'Poem Not Found | Linejam',
    };
  }

  const title = `Poem No. ${preview.poemNumber} | Linejam`;
  // Truncate description nicely
  const description =
    preview.lines.slice(0, 2).join(' / ') +
    (preview.lines.length > 2 ? '...' : '');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Linejam',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
