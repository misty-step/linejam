import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { designTokens } from '../../../lib/design';
import { getCardFontPairing, loadCardFonts } from '../../../lib/poemCard/fonts';
import { getConvexServerUrl } from '@/lib/localMode';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Poems written together on Linejam';

const identityTokens = designTokens.light;
const cardFonts = getCardFontPairing();

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [recap, { fonts }] = await Promise.all([
    fetchQuery(
      api.poems.getPublicSessionRecap,
      { roomCode: code },
      { url: getConvexServerUrl() }
    ).catch(() => null),
    loadCardFonts(),
  ]);
  const previews =
    recap?.poems.filter((poem) => poem.preview.length > 0).slice(0, 4) ?? [];
  const previewColumns = [previews.slice(0, 2), previews.slice(2)].filter(
    (column) => column.length > 0
  );

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '48px 64px',
        backgroundColor: identityTokens['color-background'],
        color: identityTokens['color-text-primary'],
        fontFamily: cardFonts.sansFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: cardFonts.displayFamily,
            fontWeight: 500,
            fontSize: 42,
            color: identityTokens['color-primary'],
          }}
        >
          Linejam
        </div>
        {recap && (
          <div style={{ fontSize: 26 }}>{`Room ${recap.roomCode}`}</div>
        )}
      </div>
      <div style={{ fontSize: 44, marginTop: 22 }}>
        {recap
          ? `${recap.poemCount} poems by ${recap.playerCount} poets`
          : 'A little room for words.'}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 28, flex: 1 }}>
        {previewColumns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {column.map((poem) => (
              <div
                key={String(poem._id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '18px 22px',
                  backgroundColor: identityTokens['color-surface'],
                  borderRadius: identityTokens['radius-lg'],
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.3,
                    color: identityTokens['color-text-secondary'],
                  }}
                >
                  {`Poem ${poem.indexInRoom + 1} / Read by ${poem.readerName}`}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}
                >
                  {poem.preview.length > 58
                    ? `${poem.preview.slice(0, 55).trimEnd()}...`
                    : poem.preview}
                </div>
              </div>
            ))}
          </div>
        ))}
        {!recap && (
          <div
            style={{
              fontSize: 30,
              color: identityTokens['color-text-secondary'],
            }}
          >
            Write a line. Pass it on.
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 20,
          fontSize: 22,
          color: identityTokens['color-text-secondary'],
        }}
      >
        <div>
          {recap && recap.poemCount > previews.length
            ? `Read all ${recap.poemCount} poems`
            : 'Written together. Read together.'}
        </div>
        <div>linejam.app</div>
      </div>
    </div>,
    { ...size, fonts }
  );
}
