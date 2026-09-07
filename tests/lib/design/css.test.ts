import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { designTokens, renderDesignTokensCss } from '@/lib/design';

describe('static design token CSS', () => {
  it('emits the typed light and dark token tables', () => {
    const css = renderDesignTokensCss();

    for (const mode of ['light', 'dark'] as const) {
      for (const [token, value] of Object.entries(designTokens[mode])) {
        expect(css).toContain(`--${token}: ${value};`);
      }
    }
    expect(css).toContain(':root.light');
    expect(css).toContain(':root.dark');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('keeps site/tokens.css generated from the typed tables', () => {
    const committed = readFileSync(
      resolve(process.cwd(), 'site/tokens.css'),
      'utf8'
    );

    expect(committed).toBe(renderDesignTokensCss());
  });
});
