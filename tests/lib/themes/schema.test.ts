import { describe, expect, it } from 'vitest';
import {
  REQUIRED_TOKENS,
  defineTheme,
  kenyaTheme,
  validateTheme,
  type ThemePreset,
} from '@/lib/themes';
import { withEnv } from '@/tests/helpers/envHelper';

function cloneTheme(): ThemePreset {
  return structuredClone(kenyaTheme) as ThemePreset;
}

function makeInvalidTheme(missingLightTokens: number): ThemePreset {
  const preset = cloneTheme();

  for (const token of REQUIRED_TOKENS.slice(0, missingLightTokens)) {
    delete (
      preset.tokens.light as unknown as Record<string, string | undefined>
    )[token];
  }

  return preset;
}

describe('theme schema', () => {
  it('reports missing required tokens across both modes', () => {
    const preset = cloneTheme();

    (preset.tokens.light as unknown as Record<string, string | undefined>)[
      'color-primary'
    ] = undefined;
    (preset.tokens.dark as unknown as Record<string, string | null>)[
      'color-primary'
    ] = null;
    (preset.tokens.dark as unknown as Record<string, string>)[
      'color-background'
    ] = '';

    const result = validateTheme(preset);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'light.color-primary',
        'dark.color-primary',
        'dark.color-background',
      ])
    );
  });

  it('throws a short validation error when a few tokens are missing', async () => {
    await withEnv({ NODE_ENV: 'development' }, async () => {
      expect(() => defineTheme(makeInvalidTheme(1))).toThrow(
        'Invalid theme "kenya": Missing tokens: light.color-primary'
      );
    });
  });

  it('throws a summarized validation error when many tokens are missing', async () => {
    await withEnv({ NODE_ENV: 'development' }, async () => {
      expect(() => defineTheme(makeInvalidTheme(6))).toThrow(
        'Invalid theme "kenya": Missing tokens: light.color-primary, light.color-primary-hover, light.color-primary-active, light.color-background, light.color-foreground (+1 more)'
      );
    });
  });

  it('skips validation in production', async () => {
    const preset = makeInvalidTheme(6);

    await withEnv({ NODE_ENV: 'production' }, async () => {
      expect(defineTheme(preset)).toBe(preset);
    });
  });
});
