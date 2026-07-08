import type { CardColors } from './colors';
import type { CardFontPairing } from './fonts';

export const POEM_PREVIEW_CARD_SIZE = { width: 1200, height: 630 };

/**
 * The "Stamp Ledger" treatment (linejam-943 design lab, option 01): a
 * left-aligned line stack, a thin primary-color rule, a sans-serif metadata
 * row, and a circular stamp mark. This is the exact visual identity
 * `app/poem/[id]/opengraph-image.tsx` has shipped since before this ticket —
 * both routes below call into it rather than inventing a second renderer.
 */
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
        padding: '60px 80px',
        fontFamily: fonts.displayFamily,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: 'auto',
        }}
      >
        {truncated.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: '40px',
              lineHeight: '1.3',
              color: colors.foreground,
              margin: 0,
              padding: 0,
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <div
        style={{
          width: '120px',
          height: '2px',
          backgroundColor: colors.primary,
          marginTop: '40px',
          marginBottom: '24px',
        }}
      />

      <div
        style={{
          fontSize: '24px',
          fontFamily: fonts.sansFamily,
          color: colors.textMuted,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {metadataLine}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '80px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: colors.primary,
          opacity: 0.9,
          transform: 'rotate(-5deg)',
        }}
      />
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
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        fontFamily: fonts.displayFamily,
      }}
    >
      <div
        style={{
          fontSize: 80,
          color: colors.primary,
          letterSpacing: '-0.02em',
        }}
      >
        Linejam
      </div>
      <div
        style={{
          fontSize: 32,
          color: colors.textMuted,
          marginTop: 20,
          fontFamily: fonts.sansFamily,
        }}
      >
        Collaborative Poetry
      </div>
    </div>
  );
}

export interface AttributedLine {
  text: string;
  authorName: string;
  isBot: boolean;
}

/**
 * Unique, order-preserving attribution string: "Emily, Marcus, Wendell (AI)".
 * Every exported/public artifact must carry this (linejam-943 criterion 3) —
 * the pre-existing card only showed a poet *count*.
 */
export function formatAttribution(lines: AttributedLine[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const line of lines) {
    const key = `${line.authorName}\u0000${line.isBot ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(line.isBot ? `${line.authorName} (AI)` : line.authorName);
  }
  return parts.join(', ');
}

const FULL_CARD_LINE_HEIGHT = 64;
const FULL_CARD_CHROME_HEIGHT = 340;
const FULL_CARD_MIN_HEIGHT = 630;
export const FULL_CARD_WIDTH = 1200;

/** Height grows with line count so the whole poem stays legible — the
 * preview card is a fixed-size teaser, the download card is the artifact. */
export function computeFullCardSize(lineCount: number) {
  return {
    width: FULL_CARD_WIDTH,
    height: Math.max(
      FULL_CARD_MIN_HEIGHT,
      FULL_CARD_CHROME_HEIGHT + lineCount * FULL_CARD_LINE_HEIGHT
    ),
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
  const metadataLine = attribution
    ? `${attribution} · linejam.app`
    : 'linejam.app';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        padding: '64px 84px',
        fontFamily: fonts.displayFamily,
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: '18px',
          fontFamily: fonts.sansFamily,
          color: colors.textMuted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '28px',
        }}
      >
        {`Poem ${poemNumber.toString().padStart(2, '0')} · Linejam`}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          marginBottom: 'auto',
        }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            style={{
              fontSize: '38px',
              lineHeight: '1.3',
              color: colors.foreground,
              margin: 0,
              padding: 0,
            }}
          >
            {line.text}
          </p>
        ))}
      </div>

      <div
        style={{
          width: '120px',
          height: '2px',
          backgroundColor: colors.primary,
          marginTop: '40px',
          marginBottom: '24px',
        }}
      />

      <div
        style={{
          fontSize: '22px',
          fontFamily: fonts.sansFamily,
          color: colors.textMuted,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {metadataLine}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '64px',
          right: '84px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: colors.primary,
          opacity: 0.9,
          transform: 'rotate(-5deg)',
        }}
      />
    </div>
  );
}
