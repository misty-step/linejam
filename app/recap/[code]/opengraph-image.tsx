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
  const lines = recap?.poems
    .slice(0, 3)
    .map((poem) =>
      poem.preview.length > 70
        ? `${poem.preview.slice(0, 67)}...`
        : poem.preview
    )
    .filter(Boolean);

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
          letterSpacing: '0.18em',
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
          flexDirection: 'column',
          gap: 14,
          marginTop: 44,
          fontSize: 30,
          lineHeight: 1.25,
        }}
      >
        {(lines && lines.length > 0
          ? lines
          : ['Write poems together, one line at a time.']
        ).map((line) => (
          <div key={line}>&ldquo;{line}&rdquo;</div>
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
