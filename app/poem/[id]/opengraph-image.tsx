import { ImageResponse } from 'next/og';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { fetchQuery } from 'convex/nextjs';
import { resolveCardColors } from '../../../lib/poemCard/colors';
import { getCardFontPairing, loadCardFonts } from '../../../lib/poemCard/fonts';
import {
  poemFallbackCardElement,
  poemPreviewCardElement,
  POEM_PREVIEW_CARD_SIZE,
} from '../../../lib/poemCard/PoemCard';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = POEM_PREVIEW_CARD_SIZE;

// Link previews always render the kenya/light identity regardless of the
// viewer's theme — social platforms cache one OG image per URL, so there is
// no "active theme" to key off of here. The themed, attributed artifact
// lives at /poem/[id]/card (see lib/poemCard/PoemCard.tsx's poemFullCardElement).
const OG_THEME_ID = 'kenya';
const colors = resolveCardColors(OG_THEME_ID, 'light');
const fonts = getCardFontPairing(OG_THEME_ID);

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { fonts: loadedFonts } = await loadCardFonts(OG_THEME_ID);

  const { id } = await params;
  const poemId = id as Id<'poems'>;

  const preview = await fetchQuery(
    api.poems.getPublicPoemPreview,
    { poemId },
    {}
  ).catch(() => null);

  if (!preview) {
    return new ImageResponse(poemFallbackCardElement({ colors, fonts }), {
      ...size,
      fonts: loadedFonts,
    });
  }

  const metadataLine = `By ${preview.poetCount} poet${preview.poetCount !== 1 ? 's' : ''} · linejam.com`;

  return new ImageResponse(
    poemPreviewCardElement({
      lines: preview.lines,
      metadataLine,
      colors,
      fonts,
    }),
    {
      ...size,
      fonts: loadedFonts,
    }
  );
}
