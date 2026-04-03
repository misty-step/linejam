// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/lib/themes';

function ThemeSnapshot() {
  const { themeId, modePreference, mode } = useTheme();
  return <span>{`${themeId}:${modePreference}:${mode}`}</span>;
}

describe('theme context SSR defaults', () => {
  it('falls back to safe defaults without browser globals', () => {
    const html = renderToString(
      <ThemeProvider>
        <ThemeSnapshot />
      </ThemeProvider>
    );

    expect(html).toContain('kenya:system:light');
  });
});
