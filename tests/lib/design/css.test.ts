import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { designTokens, renderDesignTokensCss } from '@/lib/design';

describe('static design token CSS', () => {
  it('emits the typed light and dark token tables', () => {
    const css = renderDesignTokensCss();

    expect(css).toContain('--color-primary: #b43a12;');
    expect(css).toContain('--color-focus-ring: #e85d2b;');
    expect(css).toContain('--font-display: var(--font-libre-baskerville);');
    expect(css).toContain('--text-5xl: 5.61rem;');
    expect(css).toContain('--shadow-md: 4px 4px 0px rgba(232, 93, 43, 0.1);');
    expect(css).toContain(
      `--color-primary: ${designTokens.dark['color-primary']};`
    );
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
