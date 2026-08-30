import { describe, expect, it } from 'vitest';
import { getCardFontPairing } from '@/lib/poemCard/fonts';

describe('getCardFontPairing', () => {
  it('returns the fixed Ink & Anticipation pairing', () => {
    expect(getCardFontPairing()).toMatchObject({
      displayFamily: 'Libre Baskerville',
      sansFamily: 'IBM Plex Sans',
    });
  });

  it('uses HTTPS-only font sources for both families', () => {
    const pairing = getCardFontPairing();

    expect(pairing.displayUrl).toMatch(/^https:\/\//);
    expect(pairing.sansUrl).toMatch(/^https:\/\//);
  });
});
