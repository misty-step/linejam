import { describe, expect, it } from 'vitest';
import {
  REQUIRED_TOKENS,
  defineTheme,
  kenyaTheme,
  validateTheme,
  type ThemePreset,
  type ThemeTokens,
  type ThemeValidationInput,
} from '@/lib/themes';
import { withEnv } from '@/tests/helpers/envHelper';

function makeInvalidTheme(missingLightTokens: number): ThemePreset {
  const lightTokens = { ...kenyaTheme.tokens.light };

  for (const token of REQUIRED_TOKENS.slice(0, missingLightTokens)) {
    delete lightTokens[token];
  }

  // SAFETY: Intentionally creates incomplete ThemePreset to verify theme validator rejects missing tokens.
  return {
    ...kenyaTheme,
    tokens: {
      light: lightTokens as ThemeTokens,
      dark: { ...kenyaTheme.tokens.dark },
    },
  };
}
describe('theme schema', () => {
  it('reports missing required tokens across both modes', () => {
    const lightTokens = {
      ...kenyaTheme.tokens.light,
      'color-primary': undefined,
    };
    const darkTokens = {
      ...kenyaTheme.tokens.dark,
      'color-primary': null,
      'color-background': '',
    };

    const preset: ThemeValidationInput = {
      ...kenyaTheme,
      tokens: {
        light: lightTokens,
        dark: darkTokens,
      },
    };

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
        /^Invalid theme "kenya": Missing tokens: .*\(\+1 more\)$/
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
