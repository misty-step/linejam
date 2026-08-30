import { ImageResponse } from 'next/og';
import { designTokens } from '@/lib/design';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Linejam - Write poems together, one line at a time';

const identityTokens = designTokens.light;

// Fonts (WOFF via jsDelivr)
const libreBaskervilleUrl =
  'https://cdn.jsdelivr.net/npm/@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff';
const ibmPlexSansUrl =
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff';

async function fetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  // Load fonts with individual error handling (allows partial success)
  const [libreBaskerville, ibmPlexSans] = await Promise.allSettled([
    fetchFont(libreBaskervilleUrl),
    fetchFont(ibmPlexSansUrl),
  ]).then((results) =>
    results.map((r) => (r.status === 'fulfilled' ? r.value : null))
  );

  // Diamond shape representing the 1-2-3-4-5-4-3-2-1 word pattern
  const wordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];
  const maxWidth = 200;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: identityTokens['color-background'],
        fontFamily: 'Libre Baskerville',
        position: 'relative',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 120,
          color: identityTokens['color-foreground'],
          letterSpacing: '-0.02em',
          marginBottom: 24,
        }}
      >
        Linejam
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 32,
          color: identityTokens['color-text-secondary'],
          fontFamily: 'IBM Plex Sans',
          marginBottom: 48,
        }}
      >
        Write poems together. One line at a time.
      </div>

      {/* Diamond shape visualization */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {wordCounts.map((count, i) => (
          <div
            key={i}
            style={{
              width: (count / 5) * maxWidth,
              height: 8,
              backgroundColor: identityTokens['color-primary'],
              borderRadius: 4,
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      {/* Stamp */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          right: 80,
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: identityTokens['color-primary'],
          opacity: 0.9,
          transform: 'rotate(-5deg)',
        }}
      />
    </div>,
    {
      ...size,
      fonts: [
        ...(libreBaskerville
          ? [
              {
                name: 'Libre Baskerville',
                data: libreBaskerville,
                style: 'normal' as const,
              },
            ]
          : []),
        ...(ibmPlexSans
          ? [
              {
                name: 'IBM Plex Sans',
                data: ibmPlexSans,
                style: 'normal' as const,
              },
            ]
          : []),
      ],
    }
  );
}
