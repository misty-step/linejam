/** Satori needs bundled font bytes; it cannot resolve the app's CSS variables. */
export interface CardFontPairing {
  displayFamily: string;
  sansFamily: string;
}

const CARD_FONT_PAIRING: CardFontPairing = {
  displayFamily: 'DynaPuff',
  sansFamily: 'Nunito Sans',
};

export function getCardFontPairing(): CardFontPairing {
  return CARD_FONT_PAIRING;
}

export interface LoadedCardFonts {
  fonts: Array<{
    name: string;
    data: ArrayBuffer;
    style: 'normal';
    weight: 400 | 500;
  }>;
}

async function readFont(response: Response): Promise<ArrayBuffer> {
  if (!response.ok)
    throw new Error(`Could not load image font (${response.status})`);
  return response.arrayBuffer();
}

/** Literal asset URLs let Next bundle these fonts into every edge image route. */
export async function loadCardFonts(): Promise<LoadedCardFonts> {
  const [display, sans] = await Promise.all([
    fetch(new URL('../../public/fonts/dynapuff-500.ttf', import.meta.url)).then(
      readFont
    ),
    fetch(
      new URL('../../public/fonts/nunitosans-400.ttf', import.meta.url)
    ).then(readFont),
  ]);

  return {
    fonts: [
      {
        name: CARD_FONT_PAIRING.displayFamily,
        data: display,
        style: 'normal',
        weight: 500,
      },
      {
        name: CARD_FONT_PAIRING.sansFamily,
        data: sans,
        style: 'normal',
        weight: 400,
      },
    ],
  };
}
