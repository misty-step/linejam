import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Satori needs font bytes; it cannot resolve the app's CSS variables. */
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

async function readFont(filename: string): Promise<ArrayBuffer> {
  let assets;
  try {
    assets = getCloudflareContext().env.ASSETS;
  } catch {
    // next dev/build/start run outside the Worker's request context.
  }
  if (!assets) {
    const bytes = await readFile(join(process.cwd(), 'public/fonts', filename));
    return new Uint8Array(bytes).buffer;
  }

  const response = await assets.fetch(`https://assets.local/fonts/${filename}`);
  if (!response.ok)
    throw new Error(`Could not load image font (${response.status})`);
  return response.arrayBuffer();
}

/** Workers use the static asset binding, never an origin request or file: fetch. */
export async function loadCardFonts(): Promise<LoadedCardFonts> {
  const [display, sans] = await Promise.all([
    readFont('dynapuff-500.ttf'),
    readFont('nunitosans-400.ttf'),
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
