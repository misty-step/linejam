import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import folio from '@/folio/assets/tokens.json';
import { designTokens } from '@/lib/design';
import { FOLIO_EMBLEM_SVG, FOLIO_MARK_SVG } from '@/lib/design/folio.generated';
import { AVATAR_EMBLEMS, AVATAR_IDS, AVATAR_NAMES } from '@/lib/avatars';
import { Avatar } from '@/components/ui/Avatar';
import { Brand } from '@/components/Brand';
import * as folioAssets from '@/scripts/design/folio-assets.mjs';

const root = process.cwd();
const asset = (name: string) =>
  readFileSync(resolve(root, 'folio/assets', name), 'utf8');

describe('locked Active Folio assets (DESIGN.md [D1-2])', () => {
  it('match every SHA-256 in folio/assets/checksums.json', () => {
    const manifest = folioAssets.verifyLockedAssets();
    expect(Object.keys(manifest)).toHaveLength(10);
  });

  it('serve byte-exact copies under public/folio', () => {
    const manifest = JSON.parse(asset('checksums.json'));
    for (const [file, hash] of Object.entries(manifest)) {
      const served = readFileSync(resolve(root, 'public/folio', file));
      expect(folioAssets.sha256(served), file).toBe(hash);
    }
  });

  it('keeps the generated module identical to the locked files', () => {
    expect(
      readFileSync(resolve(root, 'lib/design/folio.generated.ts'), 'utf8')
    ).toBe(folioAssets.renderGeneratedModule());
    expect(FOLIO_MARK_SVG).toBe(asset('mark.svg'));
    for (const [id, svg] of Object.entries(FOLIO_EMBLEM_SVG)) {
      expect(svg).toBe(asset(`emblem-${id}.svg`));
    }
  });

  it('renders each player emblem verbatim with its name as the label', () => {
    expect(AVATAR_IDS.map((id) => AVATAR_NAMES[id])).toEqual([
      'Loom',
      'Vesper',
      'Prism',
      'Clover',
      'Orrery',
      'Arch',
      'Pinwheel',
      'Lattice',
    ]);
    for (const id of AVATAR_IDS) {
      const html = renderToStaticMarkup(
        createElement(Avatar, { stableId: 'x', avatarId: id })
      );
      expect(html).toContain(asset(`emblem-${AVATAR_EMBLEMS[id]}.svg`));
      expect(html).toContain(`aria-label="${AVATAR_NAMES[id]}"`);
    }
  });

  it('renders the brand mark verbatim beside the wordmark', () => {
    const html = renderToStaticMarkup(createElement(Brand));
    expect(html).toContain(asset('mark.svg'));
    expect(html).toContain('Linejam');
  });
});

describe('application tokens derive from folio/assets/tokens.json', () => {
  it('exposes the canonical palette in both modes ([D1-3.1])', () => {
    const map = {
      bg: 'bg',
      'bg-desk': 'bgDesk',
      surface: 'surface',
      'surface-subtle': 'surfaceSubtle',
      'surface-elevated': 'surfaceElevated',
      ink: 'ink',
      'ink-secondary': 'inkSecondary',
      'ink-muted': 'inkMuted',
      hairline: 'hairline',
      'hairline-strong': 'hairlineStrong',
      accent: 'accent',
      'accent-hover': 'accentHover',
      'accent-ink': 'accentInk',
      'accent-soft': 'accentSoft',
      'accent-border': 'accentBorder',
      danger: 'danger',
      'danger-soft': 'dangerSoft',
      'danger-border': 'dangerBorder',
      heart: 'heartActive',
      'heart-soft': 'heartSoft',
    } as const;
    for (const mode of ['light', 'dark'] as const) {
      const emitted = Object.entries(designTokens[mode]);
      for (const [css, token] of Object.entries(map)) {
        expect(emitted).toContainEqual([css, folio[mode][token]]);
      }
    }
  });

  it('uses only folio type stacks, radii and motion', () => {
    const t = designTokens.light;
    expect(t['font-serif']).toBe(folio.typography.serif);
    expect(t['font-sans']).toBe(folio.typography.sans);
    expect(t['font-mono']).toBe(folio.typography.mono);
    expect([t['radius-sheet'], t['radius-control'], t['radius-tag']]).toEqual([
      '12px',
      '8px',
      '6px',
    ]);
    expect(t['ease-out']).toBe(folio.motion.easeOut);
    expect([
      t['duration-tap'],
      t['duration-micro'],
      t['duration-screen'],
    ]).toEqual(['90ms', '160ms', '220ms']);
    const values = Object.values(t).join(' ');
    expect(values).not.toMatch(/DynaPuff|Nunito|\bInter\b/);
  });
});
