import { ImageResponse } from 'next/og';
import { designTokens } from '@/lib/design';
import { getCardFontPairing, loadCardFonts } from '@/lib/poemCard/fonts';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Linejam — A little room for words.';

const identityTokens = designTokens.light;
const cardFonts = getCardFontPairing();

export default async function Image() {
  const { fonts } = await loadCardFonts();

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '64px 80px',
        backgroundColor: identityTokens['color-background'],
        color: identityTokens['color-text-primary'],
        fontFamily: cardFonts.sansFamily,
      }}
    >
      <div
        style={{
          fontFamily: cardFonts.displayFamily,
          fontWeight: 500,
          fontSize: 76,
          color: identityTokens['color-primary'],
        }}
      >
        Linejam
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: 64, lineHeight: 1.15 }}>
          A little room for words.
        </div>
        <div
          style={{
            fontSize: 30,
            color: identityTokens['color-text-secondary'],
          }}
        >
          A poetry game for people who don’t have to be poets.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 26,
        }}
      >
        <div
          style={{
            padding: '16px 28px',
            borderRadius: identityTokens['radius-lg'],
            backgroundColor: identityTokens['color-primary'],
            color: identityTokens['color-text-inverse'],
          }}
        >
          Write a line. Pass it on.
        </div>
        <div style={{ color: identityTokens['color-text-secondary'] }}>
          linejam.app
        </div>
      </div>
    </div>,
    { ...size, fonts }
  );
}
