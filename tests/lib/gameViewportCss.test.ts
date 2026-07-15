import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viewportCss = readFileSync('app/globals.css', 'utf8');

describe('game viewport CSS contract', () => {
  it('keeps the explicit legacy, stable, dynamic, and VisualViewport fallback order', () => {
    expect(viewportCss).toMatch(
      /\.lj-game-frame\s*\{[^}]*height:\s*100vh;[^}]*height:\s*100svh;[^}]*height:\s*var\(--lj-visual-viewport-height,\s*100dvh\);/
    );
  });

  it('does not override the positioning mode chosen by each frame', () => {
    const frameRule = viewportCss.match(/\.lj-game-frame\s*\{([^}]*)\}/)?.[1];
    expect(frameRule).toBeDefined();
    expect(frameRule).not.toMatch(/position\s*:/);
  });
});
