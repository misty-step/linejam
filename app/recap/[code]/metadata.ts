import { fetchQuery } from 'convex/nextjs';
import type { Metadata } from 'next';
import { api } from '../../../convex/_generated/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const recap = await fetchQuery(api.poems.getPublicSessionRecap, {
    roomCode: code,
  }).catch(() => null);

  if (!recap) {
    return {
      title: 'Session Not Found | Linejam',
    };
  }

  const title = `Room ${recap.roomCode} Recap | Linejam`;
  const description = `${recap.poemCount} poems by ${recap.playerCount} poets from a Linejam session.`;

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
