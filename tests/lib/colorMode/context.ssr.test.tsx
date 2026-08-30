// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ColorModeProvider, useColorMode } from '@/lib/colorMode';

function ColorModeSnapshot() {
  const { modePreference, mode } = useColorMode();
  return <span>{`${modePreference}:${mode}`}</span>;
}

describe('color mode context SSR defaults', () => {
  it('uses a deterministic light system default without browser globals', () => {
    const html = renderToString(
      <ColorModeProvider>
        <ColorModeSnapshot />
      </ColorModeProvider>
    );

    expect(html).toContain('system:light');
  });
});
