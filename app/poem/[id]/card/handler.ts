import type { ReactElement } from 'react';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { auth } from '@clerk/nextjs/server';
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

type CardPoem = {
  poem: { indexInRoom: number };
  lines: Array<{ text: string; authorName: string }>;
};

type CardRouteContext = { params: Promise<{ id: string }> };
type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>;

export interface CardRouteDependencies {
  fetchPublicPoem(poemId: Id<'poems'>): Promise<CardPoem | null>;
  fetchPoemDetail(
    poemId: Id<'poems'>,
    guestToken: string | undefined,
    clerkToken: string | null
  ): Promise<CardPoem | null>;
  getConvexToken(): Promise<string | null>;
  createImageResponse(
    element: ReactElement,
    options: ImageResponseOptions
  ): Response;
}

export interface CardRouteHandlers {
  GET(request: NextRequest, context: CardRouteContext): Promise<Response>;
  POST(request: NextRequest, context: CardRouteContext): Promise<Response>;
}

export const defaultCardRouteDependencies: CardRouteDependencies = {
  fetchPublicPoem: (poemId) =>
    fetchQuery(api.poems.getPublicPoemFull, { poemId }),
  fetchPoemDetail: (poemId, guestToken, clerkToken) =>
    clerkToken
      ? fetchQuery(
          api.poems.getPoemDetail,
          { poemId, guestToken: undefined },
          { token: clerkToken }
        )
      : fetchQuery(api.poems.getPoemDetail, { poemId, guestToken }),
  getConvexToken: async () => (await auth()).getToken({ template: 'convex' }),
  createImageResponse: (element, options) =>
    new ImageResponse(element, options),
};

/**
 * Downloadable, themed, fully-attributed poem card — the "save as image"
 * target for the reveal and archive pages (linejam-943 criterion 1). Reuses
 * the same Stamp Ledger renderer as the poem opengraph-image route
 * (lib/poemCard/PoemCard.tsx) at full length and the room's active theme,
 * rather than a second bespoke renderer.
 */
export function createCardRouteHandlers(
  dependencies: CardRouteDependencies = defaultCardRouteDependencies
): CardRouteHandlers {
  async function get(request: NextRequest, { params }: CardRouteContext) {
    const { id } = await params;
    // SAFETY: Route parameter `id` is a nominal Convex document ID validated by the query runtime.
    const poemId = id as Id<'poems'>;

    const poem = await dependencies.fetchPublicPoem(poemId).catch(() => null);

    return renderCard(request, poem, dependencies);
  }

  async function post(request: NextRequest, { params }: CardRouteContext) {
    const { id } = await params;
    // SAFETY: Route parameter `id` is a nominal Convex document ID validated by the query runtime.
    const poemId = id as Id<'poems'>;
    const body: unknown = await request.json().catch(() => ({}));
    const guestToken =
      body instanceof Object &&
      'guestToken' in body &&
      String(body.guestToken) === body.guestToken
        ? body.guestToken
        : undefined;
    let clerkToken: string | null = null;
    if (!guestToken) {
      try {
        clerkToken = await dependencies.getConvexToken();
      } catch {
        // Clerk v7 surfaces offline/token-service failures from getToken().
        // Do not turn an auth outage into a 500 or probe Convex anonymously.
        return renderCard(request, null, dependencies);
      }
    }
    const poem = await dependencies
      .fetchPoemDetail(poemId, guestToken, clerkToken)
      .catch(() => null);

    return renderCard(request, poem, dependencies);
  }

  return { GET: get, POST: post };
}

async function renderCard(
  request: NextRequest,
  poem: CardPoem | null,
  dependencies: CardRouteDependencies
) {
  const { searchParams } = new URL(request.url);
  const requestedTheme = searchParams.get('theme');
  const themeId = isValidThemeId(requestedTheme)
    ? requestedTheme
    : DEFAULT_CARD_THEME_ID;
  const mode = searchParams.get('mode') === 'dark' ? 'dark' : 'light';

  if (!poem) {
    return new Response('Poem not found or unavailable.', {
      status: 404,
    });
  }

  const colors = resolveCardColors(themeId, mode);
  const fonts = getCardFontPairing(themeId);
  const { fonts: loadedFonts } = await loadCardFonts(themeId);

  const lines: AttributedLine[] = poem.lines.map((line) => ({
    text: line.text,
    authorName: line.authorName,
  }));

  const cardSize = computeFullCardSize(lines.length);

  const image = dependencies.createImageResponse(
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
