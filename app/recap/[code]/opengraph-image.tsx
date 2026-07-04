import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { tokens } from '../../../lib/tokens';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const recap = await fetchQuery(api.poems.getPublicSessionRecap, {
    roomCode: code,
  }).catch(() => null);

  const title = recap ? `Room ${recap.roomCode}` : 'Linejam';
  const subtitle = recap
    ? `${recap.poemCount} poems by ${recap.playerCount} poets`
    : 'Session recap';
  const poemPreviews =
    recap?.poems
      .map((poem) => ({
        key: String(poem._id),
        number: (poem.indexInRoom + 1).toString().padStart(2, '0'),
        readerName: poem.readerName,
        preview:
          poem.preview.length > 58
            ? `${poem.preview.slice(0, 55).trimEnd()}...`
            : poem.preview,
      }))
      .filter((poem) => poem.preview.length > 0) ?? [];
  const midpoint = Math.ceil(poemPreviews.length / 2);
  const previewColumns = [
    poemPreviews.slice(0, midpoint),
    poemPreviews.slice(midpoint),
  ].filter((column) => column.length > 0);

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colors.background,
        color: tokens.colors.foreground,
        padding: '72px 84px',
        fontFamily: 'serif',
      }}
    >
      <div
        style={{
          fontSize: 30,
          color: tokens.colors.primary,
          fontFamily: 'sans-serif',
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 22,
          fontSize: 76,
          lineHeight: 0.95,
        }}
      >
        Session recap
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 30,
          color: tokens.colors.textMuted,
          fontFamily: 'sans-serif',
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 26,
          marginTop: 44,
        }}
      >
        {(previewColumns.length > 0
          ? previewColumns
          : [
              [
                {
                  key: 'fallback',
                  number: '01',
                  readerName: 'Linejam',
                  preview: 'Write poems together, one line at a time.',
                },
              ],
            ]
        ).map((column, columnIndex) => (
          <div
            key={`column-${columnIndex}`}
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {column.map((poem) => (
              <div
                key={poem.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: `3px solid ${tokens.colors.primary}`,
                  paddingLeft: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    color: tokens.colors.textMuted,
                    fontFamily: 'sans-serif',
                    letterSpacing: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {`Poem ${poem.number} / ${poem.readerName}`}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 26,
                    lineHeight: 1.18,
                  }}
                >
                  {`“${poem.preview}”`}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          right: 84,
          width: 70,
          height: 70,
          borderRadius: 999,
          backgroundColor: tokens.colors.primary,
          opacity: 0.9,
          transform: 'rotate(-5deg)',
        }}
      />
    </div>,
    size
  );
}
