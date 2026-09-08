import type { CardColors } from './colors';
import type { CardFontPairing } from './fonts';

export const POEM_PREVIEW_CARD_SIZE = { width: 1200, height: 630 };

/** A social preview is intentionally brief; downloads below always use every line. */
export function poemPreviewCardElement({
  lines,
  metadataLine,
  colors,
  fonts,
}: {
  lines: string[];
  metadataLine: string;
  colors: CardColors;
  fonts: CardFontPairing;
}) {
  const truncated = lines.map((line) =>
    line.length > 80 ? line.slice(0, 77) + '...' : line
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        color: colors.foreground,
        padding: '56px 80px',
        fontFamily: fonts.sansFamily,
      }}
    >
      <div
        style={{
          fontFamily: fonts.displayFamily,
          fontWeight: 500,
          fontSize: 36,
          color: colors.primary,
          marginBottom: 32,
        }}
      >
        Linejam
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}
      >
        {truncated.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: 38,
              lineHeight: 1.4,
              margin: 0,
              wordBreak: 'break-word',
            }}
          >
            {line}
          </p>
        ))}
      </div>
      <div style={{ marginTop: 28, fontSize: 24, color: colors.textMuted }}>
        {metadataLine}
      </div>
    </div>
  );
}

export function poemFallbackCardElement({
  colors,
  fonts,
}: {
  colors: CardColors;
  fonts: CardFontPairing;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '64px 80px',
        backgroundColor: colors.background,
        color: colors.foreground,
        fontFamily: fonts.sansFamily,
      }}
    >
      <div
        style={{
          fontFamily: fonts.displayFamily,
          fontWeight: 500,
          fontSize: 80,
          color: colors.primary,
        }}
      >
        Linejam
      </div>
      <div style={{ fontSize: 40, marginTop: 28 }}>
        A little room for words.
      </div>
      <div style={{ fontSize: 28, color: colors.textMuted, marginTop: 20 }}>
        Write a line. Pass it on.
      </div>
    </div>
  );
}

export interface AttributedLine {
  text: string;
  authorName: string;
}

/** Every exported/public artifact names all contributing authors. */
export function formatAttribution(lines: AttributedLine[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const line of lines) {
    if (seen.has(line.authorName)) continue;
    seen.add(line.authorName);
    parts.push(line.authorName);
  }
  return parts.join(', ');
}

export const FULL_CARD_WIDTH = 1200;
const FULL_CARD_LINE_HEIGHT = 54;
const FULL_CARD_LINE_GAP = 14;

/** Conservative character widths reserve space for wrapping, including unbroken words. */
function wrappedRows(text: string, columns: number): number {
  let rows = 0;
  for (const paragraph of text.split('\n')) {
    let used = 0;
    rows += 1;
    for (const [token] of paragraph.matchAll(/\s+|\S+/gu)) {
      const length = token.replace(/\t/g, '        ').length;
      if (used > 0 && used + length > columns) {
        rows += 1;
        used = 0;
      }
      rows += Math.floor((used + length - 1) / columns);
      used = ((used + length - 1) % columns) + 1;
    }
  }
  return rows;
}

/** The PNG grows for every wrapped poem line and author; nothing is clipped to a teaser. */
export function computeFullCardSize(lines: AttributedLine[]) {
  const poemHeight = lines.reduce(
    (height, line) =>
      height +
      wrappedRows(line.text, 24) * FULL_CARD_LINE_HEIGHT +
      FULL_CARD_LINE_GAP,
    0
  );
  const attributionHeight = wrappedRows(formatAttribution(lines), 42) * 32;
  return {
    width: FULL_CARD_WIDTH,
    height: Math.max(630, 300 + poemHeight + attributionHeight),
  };
}

export function poemFullCardElement({
  lines,
  poemNumber,
  colors,
  fonts,
}: {
  lines: AttributedLine[];
  poemNumber: number;
  colors: CardColors;
  fonts: CardFontPairing;
}) {
  const attribution = formatAttribution(lines);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        color: colors.foreground,
        padding: '64px 84px',
        fontFamily: fonts.sansFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 36,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontFamily: fonts.displayFamily,
            fontWeight: 500,
            color: colors.primary,
          }}
        >
          Linejam
        </div>
        <div style={{ fontSize: 22, color: colors.textMuted }}>
          {`Poem ${poemNumber}`}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: FULL_CARD_LINE_GAP,
          flex: 1,
        }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: 38,
              lineHeight: 1.4,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {line.text}
          </p>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 36,
          fontSize: 22,
          lineHeight: 1.45,
          color: colors.textMuted,
        }}
      >
        {attribution && (
          <div style={{ wordBreak: 'break-word' }}>{attribution}</div>
        )}
        <div>linejam.app</div>
      </div>
    </div>
  );
}
