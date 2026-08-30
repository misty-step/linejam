/**
 * Fixed Ink & Anticipation font loading for edge-rendered poem card images.
 *
 * `next/og`'s ImageResponse (Satori) needs actual font binaries, not CSS
 * `var(--font-*)` references. The canonical identity uses Libre Baskerville
 * for display text and IBM Plex Sans for metadata.
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

const CARD_FONT_PAIRING: CardFontPairing = {
  displayFamily: 'Libre Baskerville',
  sansFamily: 'IBM Plex Sans',
  displayUrl: fontsourceUrl('libre-baskerville', 400, 'normal'),
  sansUrl: fontsourceUrl('ibm-plex-sans', 400, 'normal'),
};

export function getCardFontPairing(): CardFontPairing {
  return CARD_FONT_PAIRING;
}

export interface LoadedCardFonts {
  fonts: Array<{ name: string; data: ArrayBuffer; style: 'normal' }>;
}

/**
 * Fetch the fixed identity's font binaries. Network failures fall back to an
 * empty font list — ImageResponse degrades to system fonts rather than
 * throwing, matching the existing opengraph-image routes' behavior.
 */
export async function loadCardFonts(): Promise<LoadedCardFonts> {
  const pairing = CARD_FONT_PAIRING;

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
