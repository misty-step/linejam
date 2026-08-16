import type { ReactElement } from 'react';
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

const size = POEM_PREVIEW_CARD_SIZE;

// Link previews always render the kenya/light identity regardless of the
// viewer's theme — social platforms cache one OG image per URL, so there is
// no "active theme" to key off of here. The themed, attributed artifact
// lives at /poem/[id]/card (see lib/poemCard/PoemCard.tsx's poemFullCardElement).
const OG_THEME_ID = 'kenya';
const colors = resolveCardColors(OG_THEME_ID, 'light');
const fonts = getCardFontPairing(OG_THEME_ID);

type PoemPreview = {
  lines: string[];
  poetCount: number;
};

type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>;

export interface PoemOpenGraphDependencies {
  fetchPoemPreview(
    poemId: Id<'poems'>,
    shareSlug: string | undefined
  ): Promise<PoemPreview | null>;
  createImageResponse(
    element: ReactElement,
    options: ImageResponseOptions
  ): Response;
}

export interface PoemOpenGraphImageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ share?: string }>;
}

export type PoemOpenGraphImageHandler = (
  props: PoemOpenGraphImageProps
) => Promise<Response>;

export const defaultPoemOpenGraphDependencies: PoemOpenGraphDependencies = {
  fetchPoemPreview: (poemId, shareSlug) =>
    fetchQuery(api.poems.getPublicPoemPreview, { poemId, shareSlug }, {}),
  createImageResponse: (element, options) =>
    new ImageResponse(element, options),
};

export function createPoemOpenGraphImage(
  dependencies: PoemOpenGraphDependencies = defaultPoemOpenGraphDependencies
): PoemOpenGraphImageHandler {
  return async function PoemOpenGraphImage({
    params,
    searchParams,
  }: PoemOpenGraphImageProps) {
    const { fonts: loadedFonts } = await loadCardFonts(OG_THEME_ID);

    const { id } = await params;
    const { share } = (await searchParams) ?? {};
    // SAFETY: Route parameter `id` is a nominal Convex document ID validated by the query runtime.
    const poemId = id as Id<'poems'>;

    const preview = await dependencies
      .fetchPoemPreview(poemId, share)
      .catch(() => null);

    if (!preview) {
      return dependencies.createImageResponse(
        poemFallbackCardElement({ colors, fonts }),
        {
          ...size,
          fonts: loadedFonts,
        }
      );
    }

    const metadataLine = `By ${preview.poetCount} poet${preview.poetCount !== 1 ? 's' : ''} · linejam.com`;

    return dependencies.createImageResponse(
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
  };
}

export default createPoemOpenGraphImage();
