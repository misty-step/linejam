import { ImageResponse } from 'next/og';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { fetchQuery } from 'convex/nextjs';
import { tokens } from '../../../lib/tokens';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

// Fonts (WOFF via jsDelivr to avoid wOF2 signature errors in some environments)
const libreBaskervilleUrl =
  'https://cdn.jsdelivr.net/npm/@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff';
const ibmPlexSansUrl =
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff';

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Load fonts
  const [libreBaskerville, ibmPlexSans] = await Promise.all([
    fetch(libreBaskervilleUrl).then((res) => res.arrayBuffer()),
    fetch(ibmPlexSansUrl).then((res) => res.arrayBuffer()),
  ]).catch((err) => {
    console.error('Failed to load fonts for OG image:', err);
    return [null, null];
  });

  if (!libreBaskerville || !ibmPlexSans) {
    // Fallback if fonts fail (system fonts or empty - usually implies network issue)
    // We continue, but ImageResponse might fall back to default sans-serif
    console.warn('Proceeding with OG generation without custom fonts');
  }

  // 2. Fetch Data
  const { id } = await params;
  const poemId = id as Id<'poems'>;

  const preview = await fetchQuery(
    api.poems.getPublicPoemPreview,
    { poemId },
    {
      // Next.js caching options if needed, or let Convex client handle it
    }
  ).catch(() => null); // Silent fail to fallback

  // 3. Define Fallback UI
  if (!preview) {
    return new ImageResponse(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: tokens.colors.background,
          fontFamily: 'Libre Baskerville',
        }}
      >
        <div
          style={{
            fontSize: 80,
            color: tokens.colors.primary,
            letterSpacing: '-0.02em',
          }}
        >
          Linejam
        </div>
        <div
          style={{
            fontSize: 32,
            color: tokens.colors.textMuted,
            marginTop: 20,
            fontFamily: 'IBM Plex Sans',
          }}
        >
          Collaborative Poetry
        </div>
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

  // 4. Truncate lines
  const lines = preview.lines.map((line) =>
    line.length > 80 ? line.slice(0, 77) + '...' : line
  );

  // 5. Render Poem UI
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colors.background,
        padding: '60px 80px',
        fontFamily: 'Libre Baskerville',
        position: 'relative',
      }}
    >
      {/* Poem Lines */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: 'auto',
        }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: '40px',
              lineHeight: '1.3',
              color: tokens.colors.foreground,
              margin: 0,
              padding: 0,
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          width: '120px',
          height: '2px',
          backgroundColor: tokens.colors.primary,
          marginTop: '40px',
          marginBottom: '24px',
        }}
      />

      {/* Metadata */}
      <div
        style={{
          fontSize: '24px',
          fontFamily: 'IBM Plex Sans',
          color: tokens.colors.textMuted,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        By {preview.poetCount} poet{preview.poetCount !== 1 ? 's' : ''} ·
        linejam.com
      </div>

      {/* Stamp */}
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '80px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: tokens.colors.primary,
          opacity: 0.9,
          // Mimic stamp rotation
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
