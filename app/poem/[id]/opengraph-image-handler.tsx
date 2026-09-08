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

import { getConvexServerUrl } from '@/lib/localMode';
const size = POEM_PREVIEW_CARD_SIZE;

// Link previews always render the fixed light identity. Social platforms cache
// one OG image per URL, so there is no active color mode to key off here.
const colors = resolveCardColors('light');
const fonts = getCardFontPairing();

type PoemPreview = {
  lines: string[];
  poetCount: number;
};

type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>;

export interface PoemOpenGraphDependencies {
  loadFonts: typeof loadCardFonts;
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
  loadFonts: loadCardFonts,
  fetchPoemPreview: (poemId, shareSlug) =>
    fetchQuery(
      api.poems.getPublicPoemPreview,
      { poemId, shareSlug },
      { url: getConvexServerUrl() }
    ),
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
    const { fonts: loadedFonts } = await dependencies.loadFonts();

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

    const metadataLine = `By ${preview.poetCount} poet${preview.poetCount !== 1 ? 's' : ''} on Linejam`;

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
