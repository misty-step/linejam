import { describe, expect, it } from 'vitest';
import {
  getCardFontPairing,
  DEFAULT_CARD_THEME_ID,
} from '@/lib/poemCard/fonts';

describe('getCardFontPairing', () => {
  it('returns the pairing that matches app/layout.tsx for each theme', () => {
    expect(getCardFontPairing('kenya')).toMatchObject({
      displayFamily: 'Libre Baskerville',
      sansFamily: 'IBM Plex Sans',
    });
    expect(getCardFontPairing('mono')).toMatchObject({
      displayFamily: 'Noto Serif',
      sansFamily: 'Inter',
    });
    expect(getCardFontPairing('vintage-paper')).toMatchObject({
      displayFamily: 'Cormorant Garamond',
      sansFamily: 'Source Serif 4',
    });
    expect(getCardFontPairing('hyper')).toMatchObject({
      displayFamily: 'Righteous',
      sansFamily: 'Outfit',
    });
  });

  it('falls back to the default theme for an unknown id', () => {
    expect(getCardFontPairing('not-a-theme')).toEqual(
      getCardFontPairing(DEFAULT_CARD_THEME_ID)
    );
  });

  it('gives every theme a distinct, HTTPS-only font source', () => {
    for (const id of ['kenya', 'mono', 'vintage-paper', 'hyper']) {
      const pairing = getCardFontPairing(id);
      expect(pairing.displayUrl).toMatch(/^https:\/\//);
      expect(pairing.sansUrl).toMatch(/^https:\/\//);
    }
  });
});
