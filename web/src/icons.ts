import { type Emblem, emblemName } from '../../shared/rules.ts';
import { FOLIO_SVG } from './generated/folio.ts';
import { esc } from './morph.ts';

// The mark and the eight cast emblems are the exact file text from
// folio/assets (see scripts/build.mjs), wrapped only in a sizing <span>.
// Color comes from currentColor on the wrapper.

export function mark(): string {
  return `<span class="mark" aria-hidden="true">${FOLIO_SVG['mark']}</span>`;
}

/** `labelled` when the emblem is the only thing naming its control or row. */
export function emblem(id: Emblem, options: { you?: boolean; labelled?: boolean } = {}): string {
  const label = options.labelled ? ` role="img" aria-label="${esc(emblemName(id))}"` : ' aria-hidden="true"';
  return `<span class="emblem${options.you ? ' is-you' : ''}"${label}>${FOLIO_SVG[`emblem-${id}`]}</span>`;
}

// Interface glyphs: the same 24-unit grid and 1.5 stroke as the emblems.
const glyph = (body: string) =>
  `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  system: glyph(
    '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>'
  ),
  light: glyph(
    '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>'
  ),
  dark: glyph('<path d="M19 14.2A7.5 7.5 0 0 1 9.8 5 7.5 7.5 0 1 0 19 14.2Z"/>'),
  soundOn: glyph(
    '<path d="M4.5 9.5v5h3l4 3.5v-12l-4 3.5Z"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.5 7.5 0 0 1 0 10.4"/>'
  ),
  soundOff: glyph('<path d="M4.5 9.5v5h3l4 3.5v-12l-4 3.5Z"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/>'),
  menu: glyph('<path d="M5 7.5h14M5 12h14M5 16.5h14"/>'),
  heart: glyph('<path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6Z"/>'),
  check: glyph('<path d="m5.5 12.5 4 4 9-9.5"/>'),
};
