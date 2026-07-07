import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { resolveCardColors } from '@/lib/poemCard/colors';
import {
  getCardFontPairing,
  loadCardFonts,
  DEFAULT_CARD_THEME_ID,
} from '@/lib/poemCard/fonts';
import {
  poemFullCardElement,
  computeFullCardSize,
  type AttributedLine,
} from '@/lib/poemCard/PoemCard';
import { isValidThemeId } from '@/lib/themes/registry';

export const runtime = 'edge';

/**
 * Downloadable, themed, fully-attributed poem card — the "save as image"
 * target for the reveal and archive pages (linejam-943 criterion 1). Reuses
 * the same Stamp Ledger renderer as the poem opengraph-image route
 * (lib/poemCard/PoemCard.tsx) at full length and the room's active theme,
 * rather than a second bespoke renderer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poemId = id as Id<'poems'>;

  const { searchParams } = new URL(request.url);
  const requestedTheme = searchParams.get('theme');
  const themeId = isValidThemeId(requestedTheme)
    ? requestedTheme
    : DEFAULT_CARD_THEME_ID;
  const mode = searchParams.get('mode') === 'dark' ? 'dark' : 'light';

  const poem = await fetchQuery(api.poems.getPublicPoemFull, { poemId }).catch(
    () => null
  );

  if (!poem) {
    return new Response('Poem not found or not shared publicly.', {
      status: 404,
    });
  }

  const colors = resolveCardColors(themeId, mode);
  const fonts = getCardFontPairing(themeId);
  const { fonts: loadedFonts } = await loadCardFonts(themeId);

  const lines: AttributedLine[] = poem.lines.map((line) => ({
    text: line.text,
    authorName: line.authorName,
    isBot: line.isBot,
  }));

  const cardSize = computeFullCardSize(lines.length);

  const image = new ImageResponse(
    poemFullCardElement({
      lines,
      poemNumber: poem.poem.indexInRoom + 1,
      colors,
      fonts,
    }),
    { ...cardSize, fonts: loadedFonts }
  );

  const headers = new Headers(image.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set(
    'Content-Disposition',
    `inline; filename="linejam-poem-${poem.poem.indexInRoom + 1}.png"`
  );

  return new Response(image.body, { status: image.status, headers });
}
