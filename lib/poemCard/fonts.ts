/**
 * Theme-aware font loading for edge-rendered poem card images.
 *
 * `next/og`'s ImageResponse (Satori) needs actual font binaries, not CSS
 * `var(--font-*)` references — the theme registry's `font-display`/
 * `font-sans` tokens point at CSS custom properties set up for the DOM, not
 * something Satori can resolve. This maps each theme's real display/sans
 * pairing (matching the `next/font` imports in app/layout.tsx) to a
 * fontsource WOFF URL, mirroring the fetch-and-cache pattern the poem/recap
 * opengraph-image routes already used for Libre Baskerville + IBM Plex Sans.
 */

export interface CardFontPairing {
  displayFamily: string;
  sansFamily: string;
  displayUrl: string;
  sansUrl: string;
}

function fontsourceUrl(
  pkg: string,
  weight: number,
  style: 'normal' | 'italic'
) {
  return `https://cdn.jsdelivr.net/npm/@fontsource/${pkg}/files/${pkg}-latin-${weight}-${style}.woff`;
}

const CARD_FONT_PAIRINGS: Record<string, CardFontPairing> = {
  kenya: {
    displayFamily: 'Libre Baskerville',
    sansFamily: 'IBM Plex Sans',
    displayUrl: fontsourceUrl('libre-baskerville', 400, 'normal'),
    sansUrl: fontsourceUrl('ibm-plex-sans', 400, 'normal'),
  },
  mono: {
    displayFamily: 'Noto Serif',
    sansFamily: 'Inter',
    displayUrl: fontsourceUrl('noto-serif', 400, 'normal'),
    sansUrl: fontsourceUrl('inter', 400, 'normal'),
  },
  'vintage-paper': {
    displayFamily: 'Cormorant Garamond',
    sansFamily: 'Source Serif 4',
    displayUrl: fontsourceUrl('cormorant-garamond', 400, 'normal'),
    sansUrl: fontsourceUrl('source-serif-4', 400, 'normal'),
  },
  hyper: {
    displayFamily: 'Righteous',
    sansFamily: 'Outfit',
    displayUrl: fontsourceUrl('righteous', 400, 'normal'),
    sansUrl: fontsourceUrl('outfit', 400, 'normal'),
  },
};

export const DEFAULT_CARD_THEME_ID = 'kenya';

export function getCardFontPairing(themeId: string): CardFontPairing {
  return (
    CARD_FONT_PAIRINGS[themeId] ?? CARD_FONT_PAIRINGS[DEFAULT_CARD_THEME_ID]
  );
}

export interface LoadedCardFonts {
  fonts: Array<{ name: string; data: ArrayBuffer; style: 'normal' }>;
}

/**
 * Fetch both font binaries for a theme. Network failures fall back to an
 * empty font list — ImageResponse degrades to system fonts rather than
 * throwing, matching the existing opengraph-image routes' behavior.
 */
export async function loadCardFonts(themeId: string): Promise<LoadedCardFonts> {
  const pairing = getCardFontPairing(themeId);

  const [display, sans] = await Promise.all([
    fetch(pairing.displayUrl).then((res) => res.arrayBuffer()),
    fetch(pairing.sansUrl).then((res) => res.arrayBuffer()),
  ]).catch((err) => {
    console.error('Failed to load poem card fonts:', err);
    return [null, null] as const;
  });

  const fonts: LoadedCardFonts['fonts'] = [];
  if (display) {
    fonts.push({ name: pairing.displayFamily, data: display, style: 'normal' });
  }
  if (sans) {
    fonts.push({ name: pairing.sansFamily, data: sans, style: 'normal' });
  }
  return { fonts };
}
