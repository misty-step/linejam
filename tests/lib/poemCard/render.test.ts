import { expect, it } from 'vitest';
import { ImageResponse } from 'next/og';
import {
  poemFullCardElement,
  computeFullCardSize,
} from '@/lib/poemCard/PoemCard';
import { getCardFontPairing, loadCardFonts } from '@/lib/poemCard/fonts';
import { resolveCardColors } from '@/lib/poemCard/colors';

it('renders the attributed full-poem composition as an actual PNG stream', async () => {
  const { fonts } = await loadCardFonts();
  const lines = [
    'poetry',
    'two words',
    'just three words',
    'this has four words',
    'this line has five words',
    'back to four now',
    'only three again',
    'two more',
    'end',
  ].map((text, index) => ({ text, authorName: index % 2 ? 'River' : 'Alex' }));
  const image = new ImageResponse(
    poemFullCardElement({
      lines,
      poemNumber: 2,
      colors: resolveCardColors(),
      fonts: getCardFontPairing(),
    }),
    {
      ...computeFullCardSize(lines),
      fonts,
    }
  );
  const bytes = new Uint8Array(await image.arrayBuffer());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
