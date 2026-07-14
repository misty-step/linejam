import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const globalsCss = readFileSync('app/globals.css', 'utf8');
const appError = readFileSync('app/error.tsx', 'utf8');
const globalError = readFileSync('app/global-error.tsx', 'utf8');
const lobby = readFileSync('components/Lobby.tsx', 'utf8');
const poemDisplay = readFileSync('components/PoemDisplay.tsx', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const kenyaPreset = readFileSync('lib/themes/presets/kenya.ts', 'utf8');

const textTokens = [
  'text-xs',
  'text-sm',
  'text-base',
  'text-md',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
] as const;

const spacingTokens = [
  'space-1',
  'space-2',
  'space-3',
  'space-4',
  'space-5',
  'space-6',
  'space-7',
  'space-8',
] as const;

const lineHeightTokens = [
  'leading-tight',
  'leading-normal',
  'leading-relaxed',
] as const;

const trackingTokens = [
  'tracking-tighter',
  'tracking-tight',
  'tracking-normal',
  'tracking-wide',
  'tracking-wider',
] as const;

describe('Tailwind theme contract', () => {
  it('registers runtime typography and opt-in spacing tokens as first-class Tailwind utilities', () => {
    for (const token of textTokens) {
      expect(globalsCss).toContain(`--${token}: var(--${token});`);
    }

    for (const token of spacingTokens) {
      const suffix = token.replace('space-', '');
      expect(globalsCss).toContain(`--spacing-${token}: var(--${token});`);
      expect(globalsCss).not.toContain(`--spacing-${suffix}: var(--${token});`);
    }

    for (const token of lineHeightTokens) {
      expect(globalsCss).toContain(`--${token}: var(--${token});`);
    }

    for (const token of trackingTokens) {
      expect(globalsCss).toContain(`--${token}: var(--${token});`);
    }
  });

  it('keeps application error boundaries on the theme system', () => {
    for (const source of [appError, globalError]) {
      expect(source).toContain(
        "import { Button } from '@/components/ui/Button'"
      );
      expect(source).toContain('<Button');
      expect(source).toContain('font-[var(--font-display)]');
      expect(source).not.toContain('text-muted-foreground');
    }
  });

  it('does not use raw rgba shadow escapes in the lobby chrome', () => {
    expect(lobby).not.toMatch(/shadow-\[[^\]]*rgba/);
  });

  it('uses opt-in theme spacing utilities instead of globally remapping numeric padding', () => {
    expect(poemDisplay).toContain('px-space-3');
    expect(poemDisplay).toContain('gap-space-3');
  });

  it('keeps the documented default Kenya font pairing aligned with its preset', () => {
    expect(kenyaPreset).toContain('var(--font-libre-baskerville)');
    expect(kenyaPreset).toContain('var(--font-ibm-plex)');
    expect(readme).toContain('Libre Baskerville');
    expect(readme).toContain('IBM Plex Sans');
    expect(readme).not.toContain(
      'Cormorant Garamond for display, Inter for body'
    );
  });
});
