import type { ReactElement } from 'react';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { resolveCardColors } from '@/lib/poemCard/colors';
import { getCardFontPairing, loadCardFonts } from '@/lib/poemCard/fonts';
import type { ColorMode } from '@/lib/design';
import {
  poemFullCardElement,
  computeFullCardSize,
  type AttributedLine,
} from '@/lib/poemCard/PoemCard';
import { getConvexServerUrl, isLocalServerMode } from '@/lib/localMode';

type CardPoem = {
  poem: { indexInRoom: number };
  lines: Array<{ text: string; authorName: string }>;
};

type CardRouteContext = { params: Promise<{ id: string }> };
type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>;

export interface CardRouteDependencies {
  loadFonts: typeof loadCardFonts;
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
  loadFonts: loadCardFonts,
  fetchPublicPoem: (poemId) =>
    fetchQuery(
      api.poems.getPublicPoemFull,
      { poemId },
      { url: getConvexServerUrl() }
    ),
  fetchPoemDetail: (poemId, guestToken, clerkToken) =>
    clerkToken
      ? fetchQuery(
          api.poems.getPoemDetail,
          { poemId, guestToken: undefined },
          { token: clerkToken, url: getConvexServerUrl() }
        )
      : fetchQuery(
          api.poems.getPoemDetail,
          { poemId, guestToken },
          { url: getConvexServerUrl() }
        ),
  getConvexToken: async () =>
    isLocalServerMode()
      ? null
      : (await auth()).getToken({ template: 'convex' }),
  createImageResponse: (element, options) =>
    new ImageResponse(element, options),
};

/**
 * Downloadable, fully-attributed poem card — the "save as image" target for
 * the reveal and archive pages. Reuses the same fixed-identity renderer as
 * the poem opengraph-image route (lib/poemCard/PoemCard.tsx) at full length.
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
    let guestToken: string | undefined;
    if (body instanceof Object && 'guestToken' in body) {
      try {
        const parsedToken = String.prototype.valueOf.call(body.guestToken);
        if (parsedToken === body.guestToken) guestToken = parsedToken;
      } catch {
        // Malformed JSON values are not guest credentials; continue to Clerk auth.
      }
    }
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
  const mode: ColorMode =
    searchParams.get('mode') === 'dark' ? 'dark' : 'light';

  if (!poem) {
    return new Response('Poem not found or unavailable.', {
      status: 404,
    });
  }

  const colors = resolveCardColors(mode);
  const fonts = getCardFontPairing();
  const { fonts: loadedFonts } = await dependencies.loadFonts();

  const lines: AttributedLine[] = poem.lines.map((line) => ({
    text: line.text,
    authorName: line.authorName,
  }));

  const cardSize = computeFullCardSize(lines);

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
